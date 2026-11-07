import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { createBoard, enableTestHooks, waitForHooks } from './helpers';

type Stroke = { b: string; c: string; s: number; p: number[] };
const sketches = (page: Page) =>
	page.evaluate(() => {
		const { ctx } = window.__spacy!;
		return window
			.__spacy!.list()
			.filter((e) => e.type === 'sketch')
			.map((e) => ({
				id: e.id,
				w: e.w,
				h: e.h,
				strokes: [...(ctx.store.world.strokes?.(e.id) ?? [])]
			}));
	}) as Promise<{ id: string; w: number; h: number; strokes: Stroke[] }[]>;

/** Draws a wavy line with the mouse from (x0, y) to (x1, y). */
async function wave(page: Page, y: number, x0 = 300, x1 = 620) {
	await page.mouse.move(x0, y);
	await page.mouse.down();
	for (let x = x0; x <= x1; x += 20) await page.mouse.move(x, y + Math.sin(x / 40) * 15);
	await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('b');
	await expect(page.getByRole('radio', { name: 'Pen', exact: true })).toHaveAttribute(
		'aria-checked',
		'true'
	);
});

test('a sketching session is one object; each stroke is one undo step', async ({ page }) => {
	await wave(page, 220);
	await wave(page, 280);
	await page.getByRole('radio', { name: 'Marker' }).click();
	await page.getByRole('radio', { name: 'Red' }).click();
	await wave(page, 340);

	let all = await sketches(page);
	expect(all).toHaveLength(1);
	expect(all[0]!.strokes.map((s) => s.b)).toEqual(['pen', 'pen', 'marker']);
	expect(all[0]!.strokes[2]!.c).toBe('#e03131');
	expect((await page.evaluate(() => window.__spacy!.list())).length).toBe(1);
	await expect(page.getByTestId('status-count')).toHaveText('1 object');

	await page.getByTestId('canvas').focus();
	await page.keyboard.press('ControlOrMeta+z');
	all = await sketches(page);
	expect(all[0]!.strokes).toHaveLength(2);

	// It survives a reload, strokes and all.
	await expect(page.getByText('Saved locally')).toBeVisible();
	await page.reload();
	await waitForHooks(page);
	await expect(page.locator('[data-type="sketch"] canvas')).toBeVisible();
	expect((await sketches(page))[0]!.strokes).toHaveLength(2);
});

test('the eraser erases inside the sketch without adding an object', async ({ page }) => {
	await page.getByRole('radio', { name: 'Marker' }).click();
	await page.getByRole('slider', { name: 'Brush size' }).fill('24');
	await wave(page, 260);
	const canvas = page.locator('[data-type="sketch"] canvas');
	const inked = () =>
		canvas.evaluate((c: HTMLCanvasElement) => {
			const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
			let n = 0;
			for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) n++;
			return n;
		});
	const before = await inked();
	expect(before).toBeGreaterThan(500);

	await page.getByRole('radio', { name: 'Eraser' }).click();
	const size = (await sketches(page))[0]!;
	await page.mouse.move(460, 200);
	await page.mouse.down();
	await page.mouse.move(460, 330, { steps: 6 });
	await page.mouse.up();

	const after = (await sketches(page))[0]!;
	expect(after.strokes.map((s) => s.b)).toEqual(['marker', 'eraser']);
	expect([after.w, after.h]).toEqual([size.w, size.h]); // erasing doesn't grow it
	await expect.poll(inked).toBeLessThan(before * 0.95);
});

test('leaving the tool selects the sketch; double-click continues it; "New sketch" starts another', async ({
	page
}) => {
	await wave(page, 240);
	await page.keyboard.press('v');
	const [first] = await sketches(page);
	expect(await page.evaluate(() => [...window.__spacy!.ctx.selection.ids])).toEqual([first!.id]);

	// Double-click a stroke: back in the sketch tool, drawing into the same object.
	await page.mouse.dblclick(300, 240 + Math.sin(300 / 40) * 15);
	await expect(
		page.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: 'Sketch (B)' })
	).toHaveAttribute('aria-pressed', 'true');
	await wave(page, 300);
	let all = await sketches(page);
	expect(all).toHaveLength(1);
	expect(all[0]!.strokes).toHaveLength(2);

	await page.getByRole('button', { name: 'New sketch' }).click();
	await wave(page, 420);
	all = await sketches(page);
	expect(all).toHaveLength(2);
	expect(all.map((s) => s.strokes.length).sort()).toEqual([1, 2]);
});

test('a stylus stroke keeps its pressure', async ({ page, browserName }) => {
	test.skip(
		browserName !== 'chromium',
		'stylus input is simulated through the Chromium DevTools protocol'
	);
	const cdp = await page.context().newCDPSession(page);
	const pen = (type: string, x: number, y: number, force: number) =>
		cdp.send('Input.dispatchMouseEvent', {
			type: type as 'mousePressed',
			x,
			y,
			button: 'left',
			buttons: type === 'mouseReleased' ? 0 : 1,
			clickCount: 1,
			pointerType: 'pen',
			force
		});
	await pen('mousePressed', 300, 300, 0.1);
	for (let x = 300; x <= 620; x += 16)
		await pen('mouseMoved', x, 300 + Math.sin(x / 40) * 15, 0.1 + ((x - 300) / 320) * 0.8);
	await pen('mouseReleased', 620, 300, 0);

	const [sketch] = await sketches(page);
	const pressures = sketch!.strokes[0]!.p.filter((_, i) => i % 3 === 2);
	expect(Math.min(...pressures)).toBeLessThan(0.2);
	expect(Math.max(...pressures)).toBeGreaterThan(0.8);
});

test('a sketch exports as vector paths', async ({ page }) => {
	await wave(page, 240);
	await page.getByRole('radio', { name: 'Highlighter' }).click();
	await wave(page, 300);
	await page.keyboard.press('v');
	await page.getByRole('button', { name: 'Export' }).click();
	await page.getByRole('menuitem', { name: 'SVG…' }).click();
	const dialog = page.getByRole('dialog', { name: 'Export image' });
	await expect(dialog.getByRole('img', { name: 'Export preview' })).toBeVisible();
	const [file] = await Promise.all([
		page.waitForEvent('download'),
		dialog.getByRole('button', { name: 'Download' }).click()
	]);
	const svg = await readFile((await file.path())!, 'utf8');
	expect(svg.match(/<path /g)!.length).toBeGreaterThanOrEqual(2);
	expect(svg).toContain('opacity="0.35"');
});

test('a sketch can get a colored sheet around its strokes', async ({ page }) => {
	await wave(page, 200);
	await wave(page, 400);

	await page.getByRole('button', { name: 'Sheet color' }).click();
	await page
		.getByRole('radiogroup', { name: 'Sheet color' })
		.locator('[data-color="#ffec99"]')
		.click();
	await page.keyboard.press('Escape');
	const sheet = () =>
		page.evaluate(() => {
			const e = window.__spacy!.list().find((el) => el.type === 'sketch');
			return e?.style.fillStyle === 'solid' ? e.style.fill : null;
		});
	await expect.poll(sheet).not.toBeNull();

	// The empty middle of a colored sheet belongs to the sketch.
	await page.keyboard.press('v');
	await page.mouse.click(900, 600);
	await expect.poll(() => page.evaluate(() => window.__spacy!.ctx.selection.ids.size)).toBe(0);
	await page.mouse.click(460, 300);
	await expect.poll(() => page.evaluate(() => window.__spacy!.ctx.selection.ids.size)).toBe(1);
});

test('a selected sketch says it is editable', async ({ page }) => {
	await wave(page, 200);
	await page.keyboard.press('v');
	await expect(page.getByTestId('kind-badge')).toHaveAttribute('data-kind', 'sketch');
	await expect(page.getByTestId('kind-badge')).toHaveText('Editable sketch');
});
