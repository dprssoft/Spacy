import { expect, test } from '@playwright/test';

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
