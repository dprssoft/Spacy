import { expect, test } from '@playwright/test';
import { createBoard, el, enableTestHooks, waitForHooks } from './helpers';

test('ctrl+wheel zooms, the zoom is restored after reload, and the page never scrolls', async ({
	page
}) => {
	await createBoard(page);
	const zoom = page.getByTestId('zoom-level');
	await expect(zoom).toHaveText('100%');

	const canvas = page.getByTestId('canvas');
	const box = (await canvas.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.keyboard.down('Control');
	await page.mouse.wheel(0, -100);
	await page.keyboard.up('Control');
	await expect(zoom).not.toHaveText('100%');
	const zoomed = await zoom.textContent();
	expect(parseInt(zoomed ?? '0')).toBeGreaterThan(100);

	// Save is debounced 500 ms.
	await page.waitForTimeout(700);
	await page.reload();
	await expect(page.getByTestId('zoom-level')).toHaveText(zoomed!);

	expect(
		await page.evaluate(() => [window.scrollX, window.scrollY, visualViewport?.scale])
	).toEqual([0, 0, 1]);
});

test('wheel pans; zoom buttons and shortcuts step the zoom', async ({ page }) => {
	await createBoard(page);
	const world = page.getByTestId('world');
	const before = await world.getAttribute('style');
	const box = (await page.getByTestId('canvas').boundingBox())!;
	await page.mouse.move(box.x + 200, box.y + 200);
	await page.mouse.wheel(0, 120);
	await expect(world).not.toHaveAttribute('style', before!);

	await page.getByRole('button', { name: 'Zoom in' }).click();
	await expect(page.getByTestId('zoom-level')).toHaveText('150%');
	await page.getByRole('button', { name: 'Zoom out' }).click();
	await expect(page.getByTestId('zoom-level')).toHaveText('100%');

	await page.getByTestId('canvas').focus();
	await page.keyboard.press('Control+=');
	await expect(page.getByTestId('zoom-level')).toHaveText('150%');
	await page.keyboard.press('Shift+0');
	await expect(page.getByTestId('zoom-level')).toHaveText('100%');
});

test('space + drag pans the canvas', async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await page.evaluate(
		(e) => window.__smthng!.createElements([e as never]),
		el.shape('probe', 0, 0)
	);
	const probe = page.locator('[data-element-id="probe"]');
	await expect(probe).toBeVisible();
	const before = (await probe.boundingBox())!;
	const box = (await page.getByTestId('canvas').boundingBox())!;
	await page.getByTestId('canvas').focus();
	await page.keyboard.down('Space');
	await page.mouse.move(box.x + 300, box.y + 300);
	await page.mouse.down();
	await page.mouse.move(box.x + 400, box.y + 350, { steps: 5 });
	await page.mouse.up();
	await page.keyboard.up('Space');
	const after = (await probe.boundingBox())!;
	expect(after.x - before.x).toBeCloseTo(100, 0);
	expect(after.y - before.y).toBeCloseTo(50, 0);
});
