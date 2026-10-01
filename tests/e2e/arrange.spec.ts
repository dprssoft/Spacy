import { expect, test, type Page } from '@playwright/test';
import { clickElement, createBoard, el, enableTestHooks, waitForHooks } from './helpers';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
});

type Snap = { id: string; x: number; y: number; style: { fill: string; strokeWidth: number } };
const byId = async (page: Page, id: string) =>
	((await page.evaluate(() => window.__smthng!.list())) as Snap[]).find((e) => e.id === id)!;
const add = (page: Page, els: unknown[]) =>
	page.evaluate((els) => window.__smthng!.createElements(els as never), els);

test('Align left lines up the selection', async ({ page }) => {
	await add(page, [el.shape('a', -300, -100), el.shape('b', 40, 60)]);
	await clickElement(page, 'a');
	await clickElement(page, 'b', ['Shift']);
	await page.getByTestId('style-arrange').click();
	await page.getByRole('button', { name: 'Align left' }).click();
	expect((await byId(page, 'b')).x).toBe(-300);
	expect((await byId(page, 'a')).x).toBe(-300);
});

async function dragBy(page: Page, id: string, dx: number, dy: number, mods: string[] = []) {
	const b = (await page.locator(`[data-element-id="${id}"]`).boundingBox())!;
	const from = { x: b.x + 20, y: b.y + 20 };
	for (const m of mods) await page.keyboard.down(m);
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(from.x + dx, from.y + dy, { steps: 10 });
	return async () => {
		await page.mouse.up();
		for (const m of mods) await page.keyboard.up(m);
	};
}

test('dragging near another element snaps to its edge and shows a guide', async ({ page }) => {
	await add(page, [el.shape('a', -300, -200), el.shape('b', 0, 100)]);
	// Move b left by 297px: its left edge lands 3px from a's left edge (x = -300) → snaps.
	const release = await dragBy(page, 'b', -297, 0);
	// A vertical guide has zero width, which Playwright counts as "not visible": check presence.
	await expect(page.getByTestId('snap-guide').first()).toBeAttached();
	await release();
	expect((await byId(page, 'b')).x).toBe(-300);
	await expect(page.getByTestId('snap-guide')).toHaveCount(0);
});

test('holding Ctrl/Cmd disables snapping', async ({ page }) => {
	await add(page, [el.shape('a', -300, -200), el.shape('b', 0, 100)]);
	const release = await dragBy(page, 'b', -297, 0, ['ControlOrMeta']);
	await release();
	expect((await byId(page, 'b')).x).toBe(-297);
});

test('snap to grid rounds positions to the 24px grid', async ({ page }) => {
	await add(page, [el.shape('a', 5, 7)]);
	await page.getByTestId('canvas').focus();
	await page.keyboard.press("ControlOrMeta+'");
	const release = await dragBy(page, 'a', 50, 33);
	await release();
	const a = await byId(page, 'a');
	expect(a.x % 24).toBe(0);
	expect(a.y % 24).toBe(0);
});

test('quick styles, copy/paste style and "set as default"', async ({ page }) => {
	await add(page, [el.shape('a', -300, -50), el.shape('b', 0, -50)]);
	await clickElement(page, 'a');
	await page.getByTestId('style-quick').click();
	await page.getByRole('button', { name: 'Blue style' }).click();
	expect((await byId(page, 'a')).style.fill).toBe('#a5d8ff');

	await page.keyboard.press('Escape'); // close the panel
	await page.keyboard.press('ControlOrMeta+Alt+c');
	await clickElement(page, 'b');
	await page.keyboard.press('ControlOrMeta+Alt+v');
	expect((await byId(page, 'b')).style.fill).toBe('#a5d8ff');

	await page.getByTestId('style-more').click();
	await page.getByRole('button', { name: 'Set as default for new shapes' }).click();
	await page.keyboard.press('Escape');
	const c = (await page.getByTestId('canvas').boundingBox())!;
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('r');
	await page.mouse.click(c.x + 150, c.y + 450);
	const list = (await page.evaluate(() => window.__smthng!.list())) as Snap[];
	const created = list.find((e) => e.id !== 'a' && e.id !== 'b')!;
	expect(created.style.fill).toBe('#a5d8ff');
});
