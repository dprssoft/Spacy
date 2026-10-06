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

	await page.getByRole('menuitem', { name: 'About Spacy' }).click();
	const about = page.getByRole('dialog', { name: 'Spacy' });
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
	expect(manifest).toMatchObject({ name: 'Spacy', display: 'standalone', start_url: '/' });
	expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
	expect(manifest.file_handlers[0].accept['application/x-spacy']).toEqual(['.spacy', '.smthng']);
	for (const icon of manifest.icons)
		expect((await page.request.get(`/${icon.src}`)).ok()).toBe(true);
});

test('a palette picked in Settings recolors the UI, survives a reload and can go back to the default', async ({
	page
}) => {
	await page.goto('/');
	const accent = () =>
		page.evaluate(() =>
			getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
		);
	expect(await accent()).toBe('#4f46e5');
	await page.getByRole('button', { name: 'Settings' }).click();
	await page.getByRole('menuitemradio', { name: 'Blueprint petrol' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-palette', 'petrol');
	expect(await accent()).toBe('#0e6b78');
	await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0e6b78');
	await page.getByRole('menuitemradio', { name: 'Dark' }).click();
	expect(await accent()).toBe('#5cc3cf');

	// Applied before the app starts (no flash of the default colors).
	await page.reload();
	expect(await page.evaluate(() => document.documentElement.dataset.palette)).toBe('petrol');
	expect(await accent()).toBe('#5cc3cf');

	await page.getByRole('button', { name: 'Settings' }).click();
	await page.getByRole('menuitemradio', { name: 'Indigo' }).click();
	await expect(page.locator('html')).not.toHaveAttribute('data-palette', /.*/);
	expect(await accent()).toBe('#818cf8');
});
