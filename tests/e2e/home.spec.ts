import { expect, test } from '@playwright/test';
import { createBoard } from './helpers';

test('first visit shows the empty state and the New board card', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'No boards yet' })).toBeVisible();
	await expect(page.getByRole('button', { name: /New board/ })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Recent' })).toHaveAttribute('aria-current', 'page');
});

test('New board creates a board, opens it, and it appears in Recent', async ({ page }) => {
	const id = await createBoard(page);
	expect(id).toMatch(/^[\w-]{12}$/);
	await expect(page.getByRole('heading', { name: 'Untitled board' })).toBeVisible();

	await page.goBack();
	await expect(page).toHaveURL('/');
	const card = page.getByRole('link', { name: 'Open Untitled board' });
	await expect(card).toBeVisible();
	await expect(card).toContainText('Edited just now');
	await expect(page.getByRole('heading', { name: 'No boards yet' })).toBeHidden();
});

test('views switch through the URL and the back button', async ({ page }) => {
	await createBoard(page);
	await page.goto('/');
	await page.getByRole('link', { name: 'Starred' }).click();
	await expect(page).toHaveURL('/?view=starred');
	await expect(page.getByRole('heading', { name: 'No starred boards' })).toBeVisible();
	await expect(page.getByRole('button', { name: /New board/ })).toBeHidden();

	await page.getByRole('link', { name: 'Trash' }).click();
	await expect(page.getByRole('heading', { name: 'Trash is empty' })).toBeVisible();

	await page.goBack();
	await expect(page.getByRole('heading', { name: 'No starred boards' })).toBeVisible();
	await page.goBack();
	await expect(page.getByRole('link', { name: 'Open Untitled board' })).toBeVisible();
});

test('boards created in another tab appear without reloading', async ({ page, context }) => {
	await page.goto('/');
	const other = await context.newPage();
	await createBoard(other);
	await expect(page.getByRole('link', { name: 'Open Untitled board' })).toBeVisible();
});
