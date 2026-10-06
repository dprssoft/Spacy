import { expect, test, type Page } from '@playwright/test';
import { createBoard, el, enableTestHooks, waitForHooks, waitForInitialView } from './helpers';
import { Touch } from './touch';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await waitForInitialView(page);
	// A sticky-like shape at the world origin (the canvas center), 160 × 100.
	await page.evaluate((e) => window.__spacy!.createElements([e as never]), {
		...el.shape('s', -80, -50),
		text: 'Hello'
	});
	await page.evaluate(() => window.__spacy!.ctx.selection.clear());
});

async function center(page: Page) {
	const b = (await page.getByTestId('canvas').boundingBox())!;
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
const vp = (page: Page) => page.evaluate(() => window.__spacy!.ctx.viewport.vp);
const shape = (page: Page) => page.evaluate(() => window.__spacy!.ctx.store.get('s')!);
const selected = (page: Page) => page.evaluate(() => [...window.__spacy!.ctx.selection.ids]);

test('one finger on empty canvas pans; nothing gets selected', async ({ page }) => {
	const c = await center(page);
	const before = await vp(page);
	await new Touch(page).drag({ x: c.x, y: c.y + 150 }, { x: c.x + 60, y: c.y + 230 });
	const after = await vp(page);
	expect(Math.round(after.x - before.x)).toBe(60);
	expect(Math.round(after.y - before.y)).toBe(80);
	expect(await selected(page)).toEqual([]);
});

test('one finger on an element moves it', async ({ page }) => {
	const c = await center(page);
	await new Touch(page).drag(c, { x: c.x + 50, y: c.y + 30 });
	await expect.poll(async () => (await shape(page)).x).toBe(-30);
	expect((await shape(page)).y).toBe(-20);
});

test('a pinch zooms and moves nothing, even when it starts on an element', async ({ page }) => {
	const c = await center(page);
	await new Touch(page).pinch(
		{ x: c.x, y: c.y },
		{ x: c.x + 40, y: c.y + 120 },
		{ x: c.x - 40, y: c.y - 60 },
		{ x: c.x + 80, y: c.y + 220 }
	);
	expect((await vp(page)).zoom).toBeGreaterThan(1.3);
	expect(await shape(page)).toMatchObject({ x: -80, y: -50 });
});

test('long-press then drag selects with a marquee', async ({ page }) => {
	const c = await center(page);
	await new Touch(page).drag(
		{ x: c.x - 140, y: c.y - 120 },
		{ x: c.x + 140, y: c.y + 120 },
		{ holdMs: 650 }
	);
	await expect.poll(() => selected(page)).toEqual(['s']);
	expect(await shape(page)).toMatchObject({ x: -80, y: -50 });
});

test('double-tap edits; tap on empty canvas clears the selection', async ({ page }) => {
	const c = await center(page);
	const t = new Touch(page);
	await t.doubleTap(c);
	await expect(page.getByRole('textbox', { name: 'Edit text' })).toBeFocused();
	await page.keyboard.press('Escape');
	expect(await selected(page)).toEqual(['s']);
	await t.tap({ x: c.x, y: c.y + 200 });
	await expect.poll(() => selected(page)).toEqual([]);
});
