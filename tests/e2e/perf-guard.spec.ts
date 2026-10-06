import { expect, test } from '@playwright/test';
import { createBoard, el, enableTestHooks, waitForHooks } from './helpers';

test.skip(
	({ browserName }) => browserName !== 'chromium',
	'performance guards are measured in Chromium'
);

test('dragging one element re-renders only that element', async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	expect(await page.evaluate(() => window.__spacy!.perfMixed(500))).toBeGreaterThan(450);
	// Created last, so it's on top at the canvas center.
	await page.evaluate(
		(e) => window.__spacy!.createElements([e as never]),
		el.shape('target', -80, -50)
	);
	const target = page.locator('[data-element-id="target"]');
	await expect(target).toBeVisible();
	await page.waitForTimeout(300); // let image/doc card views settle

	const counts = () => page.evaluate(() => Object.fromEntries(window.__spacy!.renderCounts));
	const before = await counts();
	const box = (await target.boundingBox())!;
	const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(from.x + 90, from.y + 60, { steps: 12 });
	await page.mouse.up();
	const moved = await page.evaluate(() => window.__spacy!.ctx.store.get('target')!.x);
	expect(moved).not.toBe(-80);

	const after = await counts();
	expect(after.target! - before.target!).toBeGreaterThan(1);
	const others = Object.keys(after).filter(
		(id) => id !== 'target' && after[id] !== (before[id] ?? 0)
	);
	expect(others).toEqual([]);
});

test('zoomed far out over many elements, the board is drawn on one canvas', async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	expect(await page.evaluate(() => window.__spacy!.perf(3000))).toBe(3000);
	const zoom = (z: number) =>
		page.evaluate((z) => {
			const v = window.__spacy!.ctx.viewport;
			v.set({ zoom: z, x: v.size.w / 2, y: v.size.h / 2 });
		}, z);

	await zoom(0.1);
	await expect(page.getByTestId('scene-canvas')).toBeVisible();
	await expect(page.locator('[data-element-id]')).toHaveCount(0);
	// Something is drawn on it.
	const painted = await page.getByTestId('scene-canvas').evaluate((c) => {
		const canvas = c as HTMLCanvasElement;
		const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
		let n = 0;
		for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) n++;
		return n;
	});
	expect(painted).toBeGreaterThan(1000);

	await zoom(1);
	await expect(page.getByTestId('scene-canvas')).toHaveCount(0);
	await expect(page.locator('[data-element-id]').first()).toBeVisible();
});

test('the start page loads no rich-text editor code', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('[data-template] img')).toHaveCount(4); // the featured templates' previews are built too
	const scripts = await page.evaluate(() =>
		performance
			.getEntriesByType('resource')
			.map((e) => e.name)
			.filter((n) => n.endsWith('.js'))
	);
	expect(scripts.length).toBeGreaterThan(3);
	expect(scripts.filter((s) => /tiptap|prosemirror/i.test(s))).toEqual([]);
	// Chunk names are hashes, so look inside the scripts that the page's own code loaded
	// statically (module preloads), not the ones the template previews fetched on demand.
	const html = await (await page.request.get('/')).text();
	const initial = [...html.matchAll(/(?:href|import\()\s*=?\s*["'(]+([^"')]+\.js)/g)].map(
		(m) => m[1]!
	);
	expect(initial.length).toBeGreaterThan(0);
	for (const src of initial) {
		const body = await (await page.request.get(src)).text();
		expect(/prosemirror|tiptap/i.test(body), src).toBe(false);
	}
});

test('doc cards show a preview when zoomed far out and an editor when zoomed in', async ({
	page
}) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	const box = (await page.getByTestId('canvas').boundingBox())!;
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('n');
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await expect(page.locator('[data-doccard-body] .ProseMirror')).toBeFocused();
	await page.keyboard.type('Readable text');
	await page.keyboard.press('Escape');
	await expect(page.locator('[data-doccard-body] .ProseMirror')).toHaveText('Readable text');

	await page.evaluate(() => {
		const v = window.__spacy!.ctx.viewport;
		v.set({ ...v.vp, zoom: 0.3 });
	});
	await expect(page.locator('[data-doccard-preview]')).toBeVisible();
	await expect(page.locator('.ProseMirror')).toHaveCount(0);

	await page.evaluate(() => {
		const v = window.__spacy!.ctx.viewport;
		v.set({ ...v.vp, zoom: 1 });
	});
	await expect(page.locator('[data-doccard-body] .ProseMirror')).toHaveText('Readable text');
});

test('leaving a doc card leaves no selection in its text', async ({ page }) => {
	// A caret left in the read-only text made the browser search the whole document for a valid
	// position on every frame: dragging a card with 1M characters ran at 10 fps.
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	const box = (await page.getByTestId('canvas').boundingBox())!;
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('n');
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	const editor = page.locator('[data-doccard-body] .ProseMirror');
	await expect(editor).toBeFocused();
	await page.keyboard.type('Some text');
	const inCard = () =>
		page.evaluate(() => {
			const node = getSelection()?.anchorNode;
			return !!node && !!document.querySelector('[data-doccard-body]')?.contains(node);
		});
	expect(await inCard()).toBe(true);
	await page.keyboard.press('Escape');
	await expect(editor).not.toBeFocused();
	expect(await inCard()).toBe(false);
});
