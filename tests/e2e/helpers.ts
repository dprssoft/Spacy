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

/** Exposes `window.__smthng` in the production build used by e2e (see src/lib/dev/testHooks.ts). */
export async function enableTestHooks(page: Page): Promise<void> {
	await page.addInitScript(() => localStorage.setItem('smthng:testHooks', 'true'));
}

/** Waits until the board's test hooks are installed. */
export async function waitForHooks(page: Page): Promise<void> {
	await page.waitForFunction(() => !!window.__smthng);
}

/** Shape/sticky/text element inputs (without z) for creating elements through the test hooks. */
export const el = {
	shape: (id: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({
		id,
		type: 'shape',
		kind: 'rect',
		text: '',
		x,
		y,
		w: 160,
		h: 100,
		rotation: 0,
		parentId: null,
		groupId: null,
		locked: false,
		style: {
			fill: '#ffffff',
			fillStyle: 'solid',
			stroke: '#1e1e1e',
			strokeWidth: 2,
			dash: 'solid',
			radius: 'sm',
			shadow: false,
			opacity: 1,
			font: { size: 'm', bold: false, italic: false, color: '#1e1e1e', align: 'c', valign: 'm' }
		},
		...extra
	})
};
