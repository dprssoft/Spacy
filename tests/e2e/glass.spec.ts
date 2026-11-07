import { expect, test } from '@playwright/test';
import { createBoard } from './helpers';

const glass = (page: import('@playwright/test').Page) =>
	page.evaluate(() => document.documentElement.dataset.glass ?? null);

test('liquid glass can be turned on, survives a reload and turns off', async ({ page }) => {
	await createBoard(page);
	expect(await glass(page)).toBeNull();
	await expect(page.getByTestId('glass-wallpaper')).toHaveCount(0);

	await page.getByRole('button', { name: 'Settings' }).click();
	await page.getByRole('menuitemcheckbox', { name: 'Liquid glass' }).click();
	await page.keyboard.press('Escape');
	await expect.poll(() => glass(page)).not.toBeNull();
	await expect(page.getByTestId('glass-wallpaper')).toBeAttached();
	await page.screenshot({ path: test.info().outputPath('glass.png') });

	await page.reload();
	await expect.poll(() => glass(page)).not.toBeNull();
	await expect(page.getByTestId('glass-wallpaper')).toBeAttached();

	await page.getByRole('button', { name: 'Settings' }).click();
	await page.getByRole('menuitemcheckbox', { name: 'Liquid glass' }).click();
	await expect.poll(() => glass(page)).toBeNull();
});

test('asking for less transparency removes the glass', async ({ page }) => {
	await page.emulateMedia({ contrast: 'more' });
	await page.addInitScript(() => localStorage.setItem('spacy:glass', 'true'));
	await createBoard(page);
	await expect(page.getByTestId('glass-wallpaper')).toBeHidden();
	const filter = await page
		.locator('main')
		.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--glass-filter'));
	expect(filter.trim()).toBe('none');
});
