import { expect, test } from '@playwright/test';

test('an unknown board id shows "Board not found" with a link home', async ({ page }) => {
	await page.goto('/board/nope');
	await expect(page.getByRole('heading', { name: 'Board not found' })).toBeVisible();
	await page.getByRole('link', { name: 'Back to boards' }).click();
	await expect(page).toHaveURL('/');
});

test('unknown routes show the error page with a link home', async ({ page }) => {
	await page.goto('/does-not-exist');
	await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
	await expect(page.getByText('404')).toBeVisible();
	await page.getByRole('link', { name: 'Back to boards' }).click();
	await expect(page).toHaveURL('/');
});
