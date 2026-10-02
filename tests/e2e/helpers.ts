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
export async function createBoard(page: Page, opts: { tips?: boolean } = {}): Promise<string> {
	// First-run tips would sit over the canvas in every test; only the onboarding test wants them.
	if (!opts.tips) await page.addInitScript(() => localStorage.setItem('smthng:onboarded', 'true'));
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

/**
 * Waits until a new, empty board has set its initial view (the origin at the canvas center).
 * The view is set asynchronously after the hooks appear; content created before that is fitted
 * on screen instead, at whatever zoom it takes.
 */
export async function waitForInitialView(page: Page): Promise<void> {
	await page.waitForFunction(() => (window.__smthng?.ctx.viewport.x ?? 0) !== 0);
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

/**
 * Clicks the center of a canvas element. Element wrappers have `pointer-events: none` (hit-testing
 * happens in code), so Playwright's locator.click() won't target them — click by position instead.
 */
export async function clickElement(
	page: Page,
	id: string,
	modifiers: ('Shift' | 'Alt' | 'ControlOrMeta')[] = []
): Promise<void> {
	const box = await page.locator(`[data-element-id="${id}"]`).boundingBox();
	if (!box) throw new Error(`element ${id} is not rendered`);
	for (const m of modifiers) await page.keyboard.down(m);
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	for (const m of modifiers) await page.keyboard.up(m);
}
