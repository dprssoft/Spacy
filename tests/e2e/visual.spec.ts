import { expect, test, type Page } from '@playwright/test';

// Baselines are rendered by one browser on one machine (fonts and anti-aliasing differ between
// systems), so this runs in Chromium and not on CI. Update with:
//   pnpm test:e2e visual --update-snapshots
test.skip(({ browserName }) => browserName !== 'chromium', 'visual baselines are Chromium-only');
test.skip(!!process.env.CI, 'visual baselines are machine-specific; run locally');

// Large enough for the fixture to fit at 100 % (a board opened for the first time fits its content).
test.use({ viewport: { width: 1440, height: 900 } });

async function openFixture(page: Page, theme: 'light' | 'dark') {
	await page.addInitScript((t) => {
		localStorage.setItem('smthng:theme', JSON.stringify(t));
		localStorage.setItem('smthng:onboarded', 'true');
	}, theme);
	await page.goto('/');
	await page.getByTestId('import-input').setInputFiles('tests/e2e/fixtures/visual-board.smthng');
	await page.getByRole('button', { name: 'Open' }).click();
	await page.waitForURL(/\/board\//);
	// Everything has rendered: the doc card's editor (lazy) and the image.
	await expect(page.locator('[data-doccard-body] h2')).toHaveText('Heading');
	await expect(page.locator('[data-type="image"] img')).toBeVisible();
	await expect(page.locator('[data-type="connector"]')).toHaveCount(13);
	await expect(page.getByText('Saved locally')).toBeVisible();
	await expect(page.getByRole('button', { name: /Zoom options, current zoom 100%/ })).toBeVisible();
	await page.mouse.move(2, 2); // no hover feedback
}

for (const theme of ['light', 'dark'] as const) {
	test(`the fixture board at 100 % zoom (${theme})`, async ({ page }) => {
		await openFixture(page, theme);
		await expect(page.getByTestId('canvas')).toHaveScreenshot(`board-${theme}.png`, {
			animations: 'disabled',
			maxDiffPixelRatio: 0.001
		});
	});
}

test('the template gallery', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('smthng:onboarded', 'true'));
	await page.goto('/');
	await page.getByRole('button', { name: 'More templates' }).click();
	const dialog = page.getByRole('dialog', { name: 'New board from a template' });
	// Every visible preview has rendered.
	await expect(dialog.locator('[data-template-card] img')).toHaveCount(20);
	await page.mouse.move(2, 2);
	await expect(dialog).toHaveScreenshot('template-gallery.png', {
		animations: 'disabled',
		maxDiffPixelRatio: 0.001
	});
});
