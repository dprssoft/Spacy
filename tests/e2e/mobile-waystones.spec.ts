import { expect, test } from '@playwright/test';
import { createBoard, enableTestHooks, waitForHooks, waitForInitialView } from './helpers';
import { Touch } from './touch';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await waitForInitialView(page);
});

test('Insert more → Tab, tap to place; the bar has touch-size buttons', async ({ page }) => {
	await page.getByRole('button', { name: 'Insert more' }).click();
	await page.getByRole('menuitem', { name: /^Tab(?!le)/ }).click();
	const b = (await page.getByTestId('canvas').boundingBox())!;
	await new Touch(page).tap({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
	const bar = page.getByTestId('waystone-bar');
	await expect(bar).toBeVisible();
	await expect(page.getByTestId('waystone-position')).toHaveText('1 / 1');
	for (const name of ['Previous tab', 'Tabs list', 'Next tab']) {
		const box = (await bar.getByRole('button', { name }).boundingBox())!;
		expect(box.height).toBeGreaterThanOrEqual(43.5);
		expect(box.width).toBeGreaterThanOrEqual(43.5);
	}
	// Docked in a strip above the status bar (not over the board); the page tabs keep their room.
	await expect(page.getByRole('tab', { name: 'Page 1' })).toBeVisible();
	expect((await page.getByRole('tab', { name: 'Page 1' }).boundingBox())!.width).toBeGreaterThan(
		40
	);
	await expect(page.getByTestId('waystone-bar')).toBeVisible();
	await expect(page.locator('main').getByTestId('waystone-bar')).toHaveCount(0);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.screenshot({
		path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/m.png` : undefined
	});
});
