import type { Page } from '@playwright/test';

/**
 * Clears all app data (IndexedDB + localStorage) and reloads. Each Playwright test already runs in a
 * fresh browser context, so this is only needed to reset state in the middle of a test.
 */
export async function resetStorage(page: Page): Promise<void> {
	await page.evaluate(async () => {
		localStorage.clear();
		const dbs = await indexedDB.databases();
		await Promise.all(
			dbs.map(
				(db) =>
					new Promise<void>((resolve) => {
						if (!db.name) return resolve();
						const req = indexedDB.deleteDatabase(db.name);
						req.onsuccess = req.onerror = req.onblocked = () => resolve();
					})
			)
		);
	});
	await page.reload();
}

/** Creates a board from the start page and returns its id (the page ends up on the board). */
export async function createBoard(page: Page): Promise<string> {
	await page.goto('/');
	await page.getByRole('button', { name: /New board/ }).click();
	await page.waitForURL(/\/board\/[\w-]+$/);
	return new URL(page.url()).pathname.split('/').pop() ?? '';
}
