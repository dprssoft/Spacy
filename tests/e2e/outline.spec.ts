import { expect, test, type Page } from '@playwright/test';
import { createBoard, enableTestHooks, waitForHooks, waitForInitialView } from './helpers';

async function insertSceneCards(page: Page) {
	await page.keyboard.press('Shift+T');
	await page.getByRole('button', { name: 'Scene cards template' }).click();
	await expect(page.locator('[data-type=doccard]')).toHaveCount(12);
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('Escape');
}
const rows = (page: Page) => page.locator('[data-outline-card]');
const titles = (page: Page) => rows(page).locator('p.font-medium').allTextContents();

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await waitForInitialView(page);
});

test('the outline lists chapters and scenes; drag a scene to another chapter', async ({ page }) => {
	await insertSceneCards(page);
	await page.keyboard.press('ControlOrMeta+Shift+O');
	const panel = page.getByTestId('outline-panel');
	await expect(panel).toBeVisible();
	await expect(panel.locator('[data-outline-chapter]')).toHaveText([
		/Chapter 1/,
		/Chapter 2/,
		/Chapter 3/
	]);
	await expect(rows(page)).toHaveCount(12);
	expect((await titles(page)).slice(0, 5)).toEqual([
		'Scene 1',
		'Scene 2',
		'Scene 3',
		'Scene 4',
		'Scene 5'
	]);

	// Scene 1 → the start of chapter 2 (drop on the upper half of Scene 5).
	const scene5 = rows(page).nth(4);
	await rows(page)
		.first()
		.dragTo(scene5, { targetPosition: { x: 20, y: 4 } });
	await expect
		.poll(() => titles(page))
		.toEqual([
			'Scene 2',
			'Scene 3',
			'Scene 4',
			'Scene 1',
			'Scene 5',
			'Scene 6',
			'Scene 7',
			'Scene 8',
			'Scene 9',
			'Scene 10',
			'Scene 11',
			'Scene 12'
		]);
	const parentOf = (title: string) =>
		page.evaluate((title) => {
			const els = window.__smthng!.list();
			const card = els.find(
				(e) => e.type === 'doccard' && (e as { title: string }).title === title
			)!;
			return (els.find((e) => e.id === card.parentId) as { title?: string } | undefined)?.title;
		}, title);
	expect(await parentOf('Scene 1')).toBe('Chapter 2');

	// One undo puts the scene back (order and frame); redo moves it again.
	const moved = await titles(page);
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('ControlOrMeta+z');
	await expect
		.poll(() => titles(page))
		.toEqual(Array.from({ length: 12 }, (_, i) => `Scene ${i + 1}`));
	expect(await parentOf('Scene 1')).toBe('Chapter 1');
	await page.keyboard.press('ControlOrMeta+Shift+z');
	await expect.poll(() => titles(page)).toEqual(moved);

	// The order is saved with the board.
	await page.reload();
	await waitForHooks(page);
	await expect(page.getByTestId('outline-panel')).toBeVisible(); // remembered per board
	expect((await titles(page))[3]).toBe('Scene 1');
	expect(await parentOf('Scene 1')).toBe('Chapter 2');
});

test('keyboard reorder, totals, click to fly, shortcut toggles', async ({ page }) => {
	await insertSceneCards(page);
	await page.getByTestId('outline-toggle').click();
	await expect(page.getByTestId('outline-total')).toContainText('words');
	const second = rows(page).nth(1);
	await second.focus();
	await page.keyboard.press('Alt+ArrowUp');
	await expect.poll(async () => (await titles(page)).slice(0, 2)).toEqual(['Scene 2', 'Scene 1']);

	await rows(page).nth(6).click();
	const id = await rows(page).nth(6).getAttribute('data-outline-card');
	await expect
		.poll(() => page.evaluate(() => [...window.__smthng!.ctx.selection.ids]))
		.toEqual([id]);

	await page.getByTestId('canvas').focus();
	await page.keyboard.press('ControlOrMeta+Shift+O');
	await expect(page.getByTestId('outline-panel')).toHaveCount(0);
});
