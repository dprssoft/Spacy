import { expect, test } from '@playwright/test';
import { createBoard } from './helpers';

test('the start page is prerendered: it shows without JavaScript, previews included', async ({
	browser
}) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	await page.goto('/');
	await expect(page.getByText('New board', { exact: true })).toBeVisible();
	await expect(page.getByText('Kanban', { exact: true })).toBeVisible();
	await expect(page.locator('img[src^="data:image/svg+xml"]').first()).toBeVisible();
	await context.close();
});

test('after hydration the stored layout, theme and the ?view= parameter apply', async ({
	page
}) => {
	await page.addInitScript(() => {
		localStorage.setItem('smthng:home:layout', '"list"');
		localStorage.setItem('smthng:theme', '"dark"');
	});
	await page.goto('/?view=starred');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await expect(page.getByRole('button', { name: 'Theme: Dark' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Starred' })).toHaveAttribute('aria-current', 'page');
	await expect(page.getByRole('button', { name: 'List view' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	// The stored choice wasn't overwritten by the defaults the page hydrated with.
	expect(await page.evaluate(() => localStorage.getItem('smthng:home:layout'))).toBe('"list"');
});

test('a board opened directly uses the SPA fallback; going home shows the prerendered page', async ({
	page
}) => {
	const id = await createBoard(page);
	await page.goto(`/board/${id}`);
	await expect(page.getByTestId('canvas')).toBeVisible();
	await page.getByRole('link', { name: 'Back to boards' }).click();
	await expect(page.getByText('Kanban', { exact: true })).toBeVisible();
	await expect(page.locator('img[src^="data:image/svg+xml"]').first()).toBeVisible();
});
