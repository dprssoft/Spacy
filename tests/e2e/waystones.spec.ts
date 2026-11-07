import { expect, test, type Page } from '@playwright/test';
import { createBoard, enableTestHooks, waitForHooks, waitForInitialView } from './helpers';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await waitForInitialView(page);
});

const zoom = (page: Page) => page.evaluate(() => window.__spacy!.ctx.viewport.zoom);
const setView = (page: Page, vp: { x: number; y: number; zoom: number }) =>
	page.evaluate((vp) => window.__spacy!.ctx.viewport.set(vp), vp);
const route = (page: Page) =>
	page.evaluate(() =>
		window.__spacy!.ctx.waystones.route.map((w) => ({ name: w.name, zoom: w.zoom }))
	);

/** Places a waystone with W at a screen offset from the canvas centre. */
async function place(page: Page, dx: number) {
	const b = (await page.getByTestId('canvas').boundingBox())!;
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('w');
	await page.mouse.click(b.x + b.width / 2 + dx, b.y + b.height / 2);
}

test('place waystones with W, fly between them, reorder, and keep the order after reload', async ({
	page
}) => {
	const bar = page.getByTestId('waystone-bar');
	await expect(bar).toContainText('Tabs'); // always there, even with no tabs yet
	await place(page, -200);
	await setView(page, { x: 300, y: 300, zoom: 2 });
	await place(page, 0);
	await setView(page, { x: 300, y: 300, zoom: 0.5 });
	await place(page, 200);
	expect(await route(page)).toEqual([
		{ name: 'Tab 1', zoom: 1 },
		{ name: 'Tab 2', zoom: 2 },
		{ name: 'Tab 3', zoom: 0.5 }
	]);
	const position = page.getByTestId('waystone-position');
	await expect(position).toHaveText('3 / 3');
	// Docked in the status bar, not over the board.
	await expect(page.locator('footer').getByTestId('waystone-bar')).toBeVisible();
	await expect(page.getByTestId('canvas').getByTestId('waystone-bar')).toHaveCount(0);

	await page.getByTestId('canvas').focus();
	await page.keyboard.press('Escape');
	await page.keyboard.press('Alt+1');
	await expect(position).toHaveText('1 / 3');
	await expect.poll(() => zoom(page)).toBe(1);
	await page.keyboard.press('PageDown');
	await expect(position).toHaveText('2 / 3');
	await expect(page.getByTestId('waystone-current')).toContainText('Tab 2');
	await expect.poll(() => zoom(page)).toBe(2);
	await page.keyboard.press('Alt+3');
	await expect.poll(() => zoom(page)).toBe(0.5);
	// Zoomed out, the labels are drawn at a constant size; one flies there.
	await expect(page.locator('[data-waystone-label]')).toHaveCount(3);
	await page.keyboard.press('PageDown');
	await expect(position).toHaveText('1 / 3');

	// The list: rename, reorder with Alt+↓.
	await page.getByTestId('waystone-current').click();
	const list = page.getByTestId('waystone-list');
	await list.getByRole('button', { name: 'Rename Tab 1' }).click();
	await list.getByRole('textbox', { name: 'Tab name' }).fill('Prologue');
	await page.keyboard.press('Enter');
	await list.locator('[data-go]').first().focus();
	await page.keyboard.press('Alt+ArrowDown');
	await expect(list.locator('[data-go]')).toHaveText(['Tab 2', 'Prologue', 'Tab 3']);

	// Presenting: only the bar is left, floating over the board.
	await page.keyboard.press('Escape');
	await page.getByTestId('waystone-current').click();
	await page.getByRole('button', { name: 'Present' }).click();
	await expect(page.locator('footer')).toHaveCount(0);
	await expect(page.getByTestId('waystone-bar')).toBeVisible();
	if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/p.png` });
	await page.getByRole('button', { name: 'Stop presenting' }).click();
	await expect(page.locator('footer').getByTestId('waystone-bar')).toBeVisible();
	if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/d.png` });

	await page.reload();
	await waitForHooks(page);
	expect((await route(page)).map((w) => w.name)).toEqual(['Tab 2', 'Prologue', 'Tab 3']);
	await expect(page.getByTestId('waystone-position')).toHaveText('– / 3');
});

test('waystones stay out of image exports unless included', async ({ page }) => {
	await place(page, 0);
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'Export' }).click();
	await page.getByRole('menuitem', { name: 'PNG…' }).click();
	const dialog = page.getByRole('dialog', { name: 'Export image' });
	await expect(dialog.getByText('Nothing to export')).toBeVisible();
	await dialog.getByTestId('export-waystones').check();
	await expect(dialog.getByRole('img', { name: 'Export preview' })).toBeVisible();
});

test('the tabs dropdown saves a spot, names it and travels back', async ({ page }) => {
	const trigger = page.getByTestId('waystone-current');
	await expect(trigger).toContainText('Tabs');
	await trigger.click();
	await page.getByRole('button', { name: 'Add tab here' }).click();
	await page.getByRole('textbox', { name: 'Tab name' }).fill('Intro');
	await page.keyboard.press('Enter');
	expect((await route(page)).map((w) => w.name)).toEqual(['Intro']);

	await page.keyboard.press('Escape');
	const view = () => page.evaluate(() => window.__spacy!.ctx.viewport.x);
	const start = await view();
	await page.getByTestId('canvas').focus();
	await page.mouse.move(600, 400);
	await page.mouse.wheel(300, 0);
	await expect.poll(view).not.toBe(start);

	await trigger.click();
	await page.getByTestId('waystone-list').getByRole('button', { name: 'Intro' }).first().click();
	await expect(page.getByTestId('waystone-list')).toBeHidden();
	await expect.poll(view).toBeCloseTo(start, 0);
});
