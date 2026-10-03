import { expect, test } from '@playwright/test';
import { createBoard, el, enableTestHooks, waitForHooks, waitForInitialView } from './helpers';

test('a template creates a connected board with a thumbnail', async ({ page }) => {
	await page.goto('/');
	const card = page.getByRole('button', { name: 'Flowchart template' });
	await expect(card.locator('img')).toBeVisible(); // the live preview
	await card.click();
	await page.waitForURL(/\/board\//);
	await expect(page.locator('[data-type="shape"]')).toHaveCount(5);
	await expect(page.locator('[data-type="connector"]')).toHaveCount(5);
	await expect(page.locator('[data-connector-label]')).toHaveText(['Yes', 'No']);

	await page.goto('/');
	const board = page.locator('article', { has: page.getByText('Flowchart', { exact: true }) });
	await expect(board.locator('img')).toBeVisible();
});

test('meeting notes opens with its document', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Meeting notes template' }).click();
	await page.waitForURL(/\/board\//);
	await expect(page.locator('[data-doccard-body] h2').last()).toHaveText('Action items');
	await expect(page.locator('[data-doccard-body] input[type=checkbox]')).toHaveCount(3);
});

test('a template is inserted into the open board from the gallery, as one undo step', async ({
	page
}) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await waitForInitialView(page);
	await page.evaluate(
		(e) => window.__smthng!.createElements([e as never]),
		el.shape('mine', 2000, 2000)
	);

	await page.getByRole('button', { name: 'Templates (Shift+T)' }).click();
	const dialog = page.getByRole('dialog', { name: 'Insert template' });
	await expect(dialog).toBeVisible();
	await dialog.getByRole('searchbox', { name: 'Search templates' }).fill('brain');
	await expect(dialog.locator('[data-template-card]')).toHaveCount(1);
	await dialog.getByRole('button', { name: 'Brainstorm template' }).click();
	await expect(dialog).toBeHidden();

	const count = () => page.evaluate(() => window.__smthng!.list().length);
	await expect.poll(count).toBeGreaterThan(8);
	const selected = await page.evaluate(() => window.__smthng!.ctx.selection.ids.size);
	expect(selected).toBe((await count()) - 1);
	await expect(page.locator('[data-type=shape]').filter({ hasText: 'Topic' })).toBeVisible();

	await page.getByTestId('canvas').focus();
	await page.keyboard.press('Escape');
	await page.keyboard.press('ControlOrMeta+z');
	await expect.poll(count).toBe(1);

	// Shift+T opens the gallery; Escape closes it.
	await page.keyboard.press('Shift+T');
	await expect(dialog).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
});
