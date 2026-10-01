import { expect, test, type Page } from '@playwright/test';
import { createBoard, enableTestHooks, waitForHooks } from './helpers';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
});

type Snap = {
	id: string;
	type: string;
	x: number;
	y: number;
	parentId: string | null;
	title?: string;
};
const list = (page: Page) => page.evaluate(() => window.__smthng!.list()) as Promise<Snap[]>;
const byType = async (page: Page, type: string) =>
	(await list(page)).filter((e) => e.type === type);
const selected = (page: Page) => page.evaluate(() => [...window.__smthng!.ctx.selection.ids]);
const canvas = async (page: Page) => (await page.getByTestId('canvas').boundingBox())!;

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps: 8 });
	await page.mouse.up();
}

/** Draws a frame from (100,80) to (600,420) on screen and a sticky inside it. */
async function frameWithSticky(page: Page) {
	const c = await canvas(page);
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('f');
	await drag(page, { x: c.x + 100, y: c.y + 80 }, { x: c.x + 600, y: c.y + 420 });
	await page.keyboard.press('s');
	await page.mouse.click(c.x + 300, c.y + 250);
	await page.keyboard.type('Inside');
	await page.keyboard.press('Escape');
	const [frame] = await byType(page, 'frame');
	const [sticky] = await byType(page, 'sticky');
	return { c, frame: frame!, sticky: sticky! };
}

async function titlePoint(page: Page) {
	const b = (await page.locator('[data-frame-title]').boundingBox())!;
	return { x: b.x + 10, y: b.y + b.height / 2 };
}

test('elements inside a frame move with it; moved out, they do not', async ({ page }) => {
	const { frame, sticky } = await frameWithSticky(page);
	expect(frame.title).toBe('Frame 1');
	expect(sticky.parentId).toBe(frame.id);

	const t = await titlePoint(page);
	await drag(page, t, { x: t.x + 60, y: t.y + 40 });
	const movedSticky = (await byType(page, 'sticky'))[0]!;
	expect(movedSticky.x - sticky.x).toBeCloseTo(60, 0);
	expect(movedSticky.y - sticky.y).toBeCloseTo(40, 0);

	// Drag the sticky out of the frame: it's released.
	const sb = (await page.locator(`[data-element-id="${sticky.id}"]`).boundingBox())!;
	await drag(page, { x: sb.x + 20, y: sb.y + 20 }, { x: sb.x + 20 + 500, y: sb.y + 20 });
	expect((await byType(page, 'sticky'))[0]!.parentId).toBeNull();
	const before = (await byType(page, 'sticky'))[0]!;
	const t2 = await titlePoint(page);
	await drag(page, t2, { x: t2.x - 30, y: t2.y });
	expect((await byType(page, 'sticky'))[0]!.x).toBe(before.x);
});

test('deleting a frame deletes its contents; undo restores both', async ({ page }) => {
	await frameWithSticky(page);
	const t = await titlePoint(page);
	await page.mouse.click(t.x, t.y);
	await page.keyboard.press('Delete');
	await expect.poll(async () => (await list(page)).length).toBe(0);
	await page.keyboard.press('ControlOrMeta+z');
	await expect.poll(async () => (await list(page)).length).toBe(2);
	expect((await byType(page, 'sticky'))[0]!.parentId).toBe((await byType(page, 'frame'))[0]!.id);
});

test('clicking inside an empty frame starts a marquee instead of selecting it', async ({
	page
}) => {
	const { c, sticky } = await frameWithSticky(page);
	await page.mouse.click(c.x + 20, c.y + 500); // deselect
	// Marquee from an empty spot inside the frame around the sticky only.
	await drag(page, { x: c.x + 130, y: c.y + 110 }, { x: c.x + 500, y: c.y + 400 });
	expect(await selected(page)).toEqual([sticky.id]);
});

test('double-click the title to rename the frame', async ({ page }) => {
	await frameWithSticky(page);
	const t = await titlePoint(page);
	await page.mouse.dblclick(t.x, t.y);
	const input = page.getByRole('textbox', { name: 'Frame title' });
	await input.fill('Sprint plan');
	await input.press('Enter');
	expect((await byType(page, 'frame'))[0]!.title).toBe('Sprint plan');
	await expect(page.locator('[data-frame-title]')).toHaveText('Sprint plan');
});

test('the zoom menu lists frames and zooms to them', async ({ page }) => {
	await frameWithSticky(page);
	await page.getByRole('button', { name: /Zoom options/ }).click();
	await page.getByRole('menuitem', { name: 'Frame 1' }).click();
	await expect(page.getByTestId('zoom-level')).not.toHaveText('100%');
});
