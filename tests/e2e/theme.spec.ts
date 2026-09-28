import { expect, test } from '@playwright/test';

test.use({ colorScheme: 'light' });

test('theme toggle persists across reloads', async ({ page }) => {
	await page.goto('/');
	const html = page.locator('html');
	await expect(html).toHaveAttribute('data-theme', 'light');

	// system → light → dark
	const toggle = page.getByRole('button', { name: /^Theme:/ });
	await expect(toggle).toHaveAccessibleName('Theme: System');
	await toggle.click();
	await expect(toggle).toHaveAccessibleName('Theme: Light');
	await toggle.click();
	await expect(toggle).toHaveAccessibleName('Theme: Dark');
	await expect(html).toHaveAttribute('data-theme', 'dark');

	await page.reload();
	await expect(html).toHaveAttribute('data-theme', 'dark');
	await expect(page.getByRole('button', { name: 'Theme: Dark' })).toBeVisible();
});

test('Tailwind theme classes follow the active theme', async ({ page }) => {
	await page.goto('/');
	const header = page.locator('header');
	const muted = page.getByText('Your boards');
	const styles = () =>
		header.evaluate((el) => {
			const h = getComputedStyle(el);
			return { bg: h.backgroundColor, border: h.borderBottomColor };
		});

	expect(await styles()).toEqual({ bg: 'rgb(255, 255, 255)', border: 'rgb(227, 227, 232)' });
	await expect(muted).toHaveCSS('color', 'rgb(107, 107, 118)');

	await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
	expect(await styles()).toEqual({ bg: 'rgb(27, 27, 31)', border: 'rgb(46, 46, 53)' });
	await expect(muted).toHaveCSS('color', 'rgb(154, 154, 165)');
});

test('the theme is applied before the app boots (no flash)', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('smthng:theme', '"dark"'));
	// Block the app bundle: only the inline script in app.html can set the theme.
	await page.route('**/_app/**', (route) => route.abort());
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('system mode follows the OS preference', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await page.emulateMedia({ colorScheme: 'light' });
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
