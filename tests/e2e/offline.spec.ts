import { expect, test } from '@playwright/test';
import { createBoard, el, enableTestHooks, waitForHooks } from './helpers';

test('boards and the start page work offline after the first visit', async ({ page, context }) => {
	await enableTestHooks(page);
	const id = await createBoard(page);
	await waitForHooks(page);
	await page.evaluate(
		(e) => window.__smthng!.createElements([e as never]),
		el.shape('a', -80, -50, { text: 'Offline' })
	);
	// An active worker has finished precaching; it serves the next navigation.
	await page.evaluate(async () => {
		const reg = await navigator.serviceWorker.ready;
		return reg.active?.state;
	});
	await expect(page.getByText('Saved locally')).toBeVisible();

	await context.setOffline(true);
	await page.reload();
	await expect(page.locator('[data-element-id="a"]')).toHaveText('Offline');

	await page.goto('/');
	await expect(page.locator(`article[data-board-id="${id}"]`)).toBeVisible();
	// Lazy chunks are precached too: template previews render offline.
	await expect(page.locator('[data-template] img')).toHaveCount(3);
});
