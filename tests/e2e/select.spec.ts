import { expect, test, type Page } from '@playwright/test';
import { clickElement, createBoard, el, enableTestHooks, waitForHooks } from './helpers';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
});

type Snap = { id: string; x: number; y: number; w: number; h: number; rotation: number };
const list = (page: Page) => page.evaluate(() => window.__smthng!.list()) as Promise<Snap[]>;
const byId = async (page: Page, id: string) => (await list(page)).find((e) => e.id === id)!;
const selected = (page: Page) =>
	page.evaluate(() => [...window.__smthng!.ctx.selection.ids].sort());
const add = (page: Page, els: unknown[]) =>
	page.evaluate((els) => window.__smthng!.createElements(els as never), els);
const canvas = async (page: Page) => (await page.getByTestId('canvas').boundingBox())!;

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps: 8 });
	await page.mouse.up();
}

async function handle(page: Page, id: string) {
	const b = (await page.locator(`[data-handle="${id}"]`).boundingBox())!;
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

test('marquee selects two shapes; dragging moves both as one undo step', async ({ page }) => {
	await add(page, [el.shape('a', -300, -50), el.shape('b', 0, -50)]);
	const c = await canvas(page);
	// Start the marquee on empty canvas, top-left of both shapes.
	await drag(page, { x: c.x + 40, y: c.y + 40 }, { x: c.x + c.width - 40, y: c.y + c.height - 40 });
	expect(await selected(page)).toEqual(['a', 'b']);

	const a0 = await byId(page, 'a');
	const b0 = await byId(page, 'b');
	const box = (await page.locator('[data-element-id="a"]').boundingBox())!;
	const from = { x: box.x + 20, y: box.y + 20 };
	await drag(page, from, { x: from.x + 50, y: from.y + 30 });
	const a1 = await byId(page, 'a');
	const b1 = await byId(page, 'b');
	expect(a1.x - a0.x).toBeCloseTo(50, 0);
	expect(a1.y - a0.y).toBeCloseTo(30, 0);
	expect(b1.x - b0.x).toBeCloseTo(a1.x - a0.x, 5);

	await page.evaluate(() => window.__smthng!.ctx.undo.undo());
	expect((await byId(page, 'a')).x).toBe(a0.x);
	expect((await byId(page, 'b')).x).toBe(b0.x);
});

test('the SE handle resizes; Shift keeps the aspect ratio', async ({ page }) => {
	await add(page, [el.shape('a', -100, -50)]);
	await clickElement(page, 'a');
	const se = await handle(page, 'se');
	await drag(page, se, { x: se.x + 60, y: se.y + 20 });
	expect(await byId(page, 'a')).toMatchObject({ x: -100, y: -50, w: 220, h: 120 });

	const se2 = await handle(page, 'se');
	await page.keyboard.down('Shift');
	await drag(page, se2, { x: se2.x + 110, y: se2.y });
	await page.keyboard.up('Shift');
	const r = await byId(page, 'a');
	expect(r.w / r.h).toBeCloseTo(220 / 120, 2);
});

test('the rotate handle rotates; Shift snaps to 15°', async ({ page }) => {
	await add(page, [el.shape('a', -80, -50)]);
	await clickElement(page, 'a');
	const rot = await handle(page, 'rotate');
	const box = (await page.locator('[data-element-id="a"]').boundingBox())!;
	const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	await page.keyboard.down('Shift');
	// Move to roughly 50° clockwise from "up".
	const r = Math.hypot(rot.x - center.x, rot.y - center.y);
	const ang = (-90 + 50) * (Math.PI / 180);
	await drag(page, rot, { x: center.x + Math.cos(ang) * r, y: center.y + Math.sin(ang) * r });
	await page.keyboard.up('Shift');
	const deg = ((await byId(page, 'a')).rotation * 180) / Math.PI;
	expect(deg).toBeCloseTo(45, 5);
});

test('Alt+drag duplicates; Escape during a drag reverts it', async ({ page }) => {
	await add(page, [el.shape('a', -100, -50)]);
	const box = (await page.locator('[data-element-id="a"]').boundingBox())!;
	const from = { x: box.x + 30, y: box.y + 30 };
	await page.keyboard.down('Alt');
	await drag(page, from, { x: from.x + 200, y: from.y });
	await page.keyboard.up('Alt');
	const els = await list(page);
	expect(els).toHaveLength(2);
	expect(els.find((e) => e.id === 'a')).toMatchObject({ x: -100 });
	const copy = els.find((e) => e.id !== 'a')!;
	expect(copy.x).toBeCloseTo(100, 0);
	expect(await selected(page)).toEqual([copy.id]);

	const depth = await page.evaluate(() => window.__smthng!.ctx.undo.undoStack.length);
	const b2 = (await page.locator(`[data-element-id="${copy.id}"]`).boundingBox())!;
	await page.mouse.move(b2.x + 30, b2.y + 30);
	await page.mouse.down();
	await page.mouse.move(b2.x + 130, b2.y + 80, { steps: 5 });
	await page.keyboard.press('Escape');
	await page.mouse.up();
	expect((await byId(page, copy.id)).x).toBeCloseTo(copy.x, 5);
	expect(await page.evaluate(() => window.__smthng!.ctx.undo.undoStack.length)).toBe(depth);
});

test('grouped elements select together; double-click enters the group', async ({ page }) => {
	await add(page, [
		el.shape('a', -300, -50, { groupId: 'g1' }),
		el.shape('b', 0, -50, { groupId: 'g1' }),
		el.shape('c', -100, 150)
	]);
	await clickElement(page, 'a');
	expect(await selected(page)).toEqual(['a', 'b']);
	const box = (await page.locator('[data-element-id="b"]').boundingBox())!;
	await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
	expect(await selected(page)).toEqual(['b']);
});

test('locked elements can be selected but not moved', async ({ page }) => {
	await add(page, [el.shape('a', -100, -50, { locked: true })]);
	const box = (await page.locator('[data-element-id="a"]').boundingBox())!;
	await drag(page, { x: box.x + 30, y: box.y + 30 }, { x: box.x + 130, y: box.y + 30 });
	expect(await selected(page)).toEqual(['a']);
	expect((await byId(page, 'a')).x).toBe(-100);
	await expect(page.locator('[data-handle]')).toHaveCount(0);
});

test('arrow keys nudge; Mod+A selects all', async ({ page }) => {
	await add(page, [el.shape('a', -300, -50), el.shape('b', 0, -50)]);
	await clickElement(page, 'a');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Shift+ArrowDown');
	expect(await byId(page, 'a')).toMatchObject({ x: -299, y: -40 });
	await page.keyboard.press('ControlOrMeta+a');
	expect(await selected(page)).toEqual(['a', 'b']);
});
