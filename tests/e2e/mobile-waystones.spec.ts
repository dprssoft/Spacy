import { expect, test } from '@playwright/test';
import { createBoard, enableTestHooks, waitForHooks, waitForInitialView } from './helpers';
import { Touch } from './touch';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await waitForInitialView(page);
});

test('Insert more → Waystone, tap to place; the bar has touch-size buttons', async ({ page }) => {
	await page.getByRole('button', { name: 'Insert more' }).click();
	await page.getByRole('menuitem', { name: /Waystone/ }).click();
	const b = (await page.getByTestId('canvas').boundingBox())!;
	await new Touch(page).tap({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
	const bar = page.getByTestId('waystone-bar');
	await expect(bar).toBeVisible();
	await expect(page.getByTestId('waystone-position')).toHaveText('1 / 1');
	for (const name of ['Previous waystone', 'Waystones list', 'Next waystone']) {
		const box = (await bar.getByRole('button', { name }).boundingBox())!;
		expect(box.height).toBeGreaterThanOrEqual(43.5);
		expect(box.width).toBeGreaterThanOrEqual(43.5);
	}
});
