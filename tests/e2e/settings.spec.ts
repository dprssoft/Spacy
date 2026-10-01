import { expect, test } from '@playwright/test';
import { createBoard } from './helpers';

test('the settings menu shows storage, switches the theme and opens About', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Settings' }).click();
	await expect(page.getByTestId('storage-info')).toHaveText(
		/Using [\d.]+ (B|KB|MB|GB) · Persistent: (yes|no)/
	);

	await page.getByRole('menuitemradio', { name: 'Dark' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await page.getByRole('menuitemradio', { name: 'Light' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

	await page.getByRole('menuitem', { name: 'About SMTHNG' }).click();
	const about = page.getByRole('dialog', { name: 'SMTHNG' });
	await expect(about).toContainText(/Version \d+\.\d+\.\d+/);
	await expect(about).toContainText('Boards are stored only in this browser.');
});

test('the settings menu is available on a board', async ({ page }) => {
	await createBoard(page);
	await page.getByRole('button', { name: 'Settings' }).click();
	await expect(page.getByRole('menuitem', { name: 'Backup all boards' })).toBeVisible();
});

test('the backup reminder appears with three boards and can be postponed', async ({ page }) => {
	for (let i = 0; i < 3; i++) await createBoard(page);
	await page.goto('/');
	const reminder = page.getByTestId('backup-reminder');
	await expect(reminder).toContainText('Your boards live only in this browser.');
	await reminder.getByRole('button', { name: 'Later' }).click();
	await expect(reminder).toBeHidden();
	await page.reload();
	await expect(page.locator('article[data-board-id]')).toHaveCount(3);
	await expect(reminder).toBeHidden();
});

test('the web app manifest is served with icons and the file handler', async ({ page }) => {
	const res = await page.request.get('/manifest.webmanifest');
	expect(res.ok()).toBe(true);
	const manifest = await res.json();
	expect(manifest).toMatchObject({ name: 'SMTHNG', display: 'standalone', start_url: '/' });
	expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
	expect(manifest.file_handlers[0].accept['application/x-smthng']).toEqual(['.smthng']);
	for (const icon of manifest.icons)
		expect((await page.request.get(`/${icon.src}`)).ok()).toBe(true);
});
