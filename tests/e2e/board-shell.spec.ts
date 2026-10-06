import { expect, test, type Page } from '@playwright/test';
import { createBoard } from './helpers';

async function renameBoard(page: Page, to: string) {
	await page.getByRole('button', { name: /^Rename board:/ }).click();
	const input = page.getByRole('textbox', { name: 'Board title' });
	await input.fill(to);
	await input.press('Enter');
	await expect(page.getByRole('button', { name: `Rename board: ${to}` })).toBeVisible();
}

test('renaming in the top bar persists and shows on the start page', async ({ page }) => {
	await createBoard(page);
	await expect(page.getByText('Saved locally')).toBeVisible();
	await renameBoard(page, 'Roadmap');
	await expect(page).toHaveTitle('Roadmap — Spacy');

	await page.reload();
	await expect(page.getByRole('button', { name: 'Rename board: Roadmap' })).toBeVisible();

	await page.getByRole('link', { name: 'Back to boards' }).click();
	await expect(page.getByRole('link', { name: 'Open Roadmap' })).toBeVisible();
});

test('a rename in one tab updates the other tab', async ({ page, context }) => {
	const id = await createBoard(page);
	const other = await context.newPage();
	await other.goto(`/board/${id}`);
	await expect(other.getByRole('button', { name: 'Rename board: Untitled board' })).toBeVisible();

	await renameBoard(page, 'Shared title');
	await expect(other.getByRole('button', { name: 'Rename board: Shared title' })).toBeVisible({
		timeout: 1000
	});
});

test('Escape cancels a rename', async ({ page }) => {
	await createBoard(page);
	await page.getByRole('button', { name: /^Rename board:/ }).click();
	await page.getByRole('textbox', { name: 'Board title' }).fill('Nope');
	await page.keyboard.press('Escape');
	await expect(page.getByRole('button', { name: 'Rename board: Untitled board' })).toBeVisible();
});

test('a trashed board shows the trashed state and can be restored', async ({ page }) => {
	const id = await createBoard(page);
	await page.goto('/');
	const card = page.locator('article').first();
	await card.hover();
	await card.getByRole('button', { name: 'Board actions' }).click();
	await page.getByRole('menuitem', { name: 'Move to trash' }).click();

	await page.goto(`/board/${id}`);
	await expect(page.getByRole('heading', { name: 'This board is in the trash' })).toBeVisible();
	await page.getByRole('button', { name: 'Restore' }).click();
	await expect(page.getByRole('button', { name: 'Rename board: Untitled board' })).toBeVisible();
});
