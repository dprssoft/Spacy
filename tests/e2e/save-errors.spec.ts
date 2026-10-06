import { expect, test, type Page } from '@playwright/test';
import { createBoard, el, enableTestHooks, waitForHooks } from './helpers';

const leavingAsks = (page: Page) =>
	page.evaluate(() => {
		const e = new Event('beforeunload', { cancelable: true });
		window.dispatchEvent(e);
		return e.defaultPrevented;
	});

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
});

test('a failed save is shown, warns before leaving, and retry saves everything', async ({
	page
}) => {
	const indicator = page.getByTestId('save-indicator');
	await expect(indicator).toContainText('Saved locally');

	// Storage full: every write fails until it's restored.
	await page.evaluate(() => {
		const w = window as unknown as { __add?: typeof IDBObjectStore.prototype.add };
		w.__add = IDBObjectStore.prototype.add;
		IDBObjectStore.prototype.add = () => {
			throw new DOMException('Quota exceeded', 'QuotaExceededError');
		};
	});
	await page.evaluate(
		(e) => window.__spacy!.createElements([e as never]),
		el.shape('kept', -80, -50, { text: 'kept' })
	);
	await expect(indicator).toContainText('Not saved');
	await expect(page.getByText('Changes aren’t being saved')).toBeVisible();

	// Leaving asks first.
	expect(await leavingAsks(page)).toBe(true);

	await page.evaluate(() => {
		const w = window as unknown as { __add: typeof IDBObjectStore.prototype.add };
		IDBObjectStore.prototype.add = w.__add;
	});
	await page.getByRole('button', { name: 'Retry' }).click();
	await expect(indicator).toContainText('Saved locally');
	expect(await leavingAsks(page)).toBe(false);

	await page.reload();
	await expect(page.locator('[data-element-id="kept"]')).toHaveText('kept');
});
