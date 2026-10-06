import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { createBoard, enableTestHooks, waitForHooks } from './helpers';

const SAMPLE = 'tests/e2e/fixtures/sample.png';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
});

type Snap = {
	id: string;
	type: string;
	x: number;
	y: number;
	w: number;
	h: number;
	assetId?: string;
};
const list = (page: Page) => page.evaluate(() => window.__spacy!.list()) as Promise<Snap[]>;
const canvas = async (page: Page) => (await page.getByTestId('canvas').boundingBox())!;

async function press(page: Page, key: string) {
	await page.getByTestId('canvas').focus();
	await page.keyboard.press(key);
}

async function scribble(page: Page, x: number, y: number) {
	await page.mouse.move(x, y);
	await page.mouse.down();
	for (let i = 1; i <= 20; i++) await page.mouse.move(x + i * 8, y + Math.sin(i / 2) * 25);
}

test('the pen draws a stroke that persists; the eraser deletes it', async ({ page }) => {
	const c = await canvas(page);
	await press(page, 'p');
	await scribble(page, c.x + 300, c.y + 300);
	await expect(page.getByTestId('stroke-preview')).toBeVisible();
	expect(await list(page)).toEqual([]); // nothing written until release
	await page.mouse.up();
	await expect(page.getByTestId('stroke-preview')).toBeHidden();

	const [stroke] = await list(page);
	expect(stroke).toMatchObject({ type: 'stroke' });
	expect(stroke!.w).toBeGreaterThan(140);
	// The pen stays active for the next stroke.
	await expect(page.getByRole('button', { name: 'Pen' })).toHaveAttribute('aria-pressed', 'true');
	expect(await page.evaluate(() => window.__spacy!.ctx.undo.undoStack.length)).toBe(1);

	await page.reload();
	await expect(page.locator('[data-type="stroke"] path')).toHaveCount(1);

	await press(page, 'e');
	await page.mouse.move(c.x + 380, c.y + 200);
	await page.mouse.down();
	await page.mouse.move(c.x + 380, c.y + 420, { steps: 10 });
	await expect(page.locator('[data-type="stroke"]')).toHaveClass(/opacity-30/);
	await page.mouse.up();
	await expect.poll(async () => (await list(page)).length).toBe(0);
});

test('Escape cancels erasing', async ({ page }) => {
	const c = await canvas(page);
	await press(page, 'p');
	await scribble(page, c.x + 300, c.y + 300);
	await page.mouse.up();
	await press(page, 'e');
	await page.mouse.move(c.x + 380, c.y + 200);
	await page.mouse.down();
	await page.mouse.move(c.x + 380, c.y + 420, { steps: 10 });
	await page.keyboard.press('Escape');
	await page.mouse.up();
	expect(await list(page)).toHaveLength(1);
});

test('uploading an image adds it and it survives a reload', async ({ page }) => {
	const chooser = page.waitForEvent('filechooser');
	await page.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: 'Image' }).click();
	await (await chooser).setFiles(SAMPLE);
	await expect.poll(async () => (await list(page))[0]?.type).toBe('image');
	const [img] = await list(page);
	expect([img!.w, img!.h]).toEqual([64, 48]);

	const loaded = () =>
		page.locator('[data-type="image"] img').evaluate((el: HTMLImageElement) => el.naturalWidth);
	await expect.poll(loaded).toBe(64);
	await page.reload();
	await expect.poll(loaded).toBe(64);
});

async function dispatchWithFile(page: Page, kind: 'drop' | 'paste', at?: { x: number; y: number }) {
	const bytes = [...readFileSync(SAMPLE)];
	await page.evaluate(
		({ bytes, kind, at }) => {
			const dt = new DataTransfer();
			dt.items.add(new File([new Uint8Array(bytes)], 'dropped.png', { type: 'image/png' }));
			if (kind === 'paste') {
				// Firefox drops `clipboardData` given to a synthetic event's constructor.
				const e = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
				Object.defineProperty(e, 'clipboardData', { value: dt });
				document.dispatchEvent(e);
				return;
			}
			const target = document.querySelector('[data-testid=canvas]')!;
			const init = {
				dataTransfer: dt,
				bubbles: true,
				cancelable: true,
				clientX: at!.x,
				clientY: at!.y
			};
			target.dispatchEvent(new DragEvent('dragover', init));
			target.dispatchEvent(new DragEvent('drop', init));
		},
		{ bytes, kind, at }
	);
}

test('dropping an image file places it at the drop point', async ({ page }) => {
	const c = await canvas(page);
	const at = { x: c.x + 250, y: c.y + 200 };
	await dispatchWithFile(page, 'drop', at);
	await expect.poll(async () => (await list(page))[0]?.type).toBe('image');
	const box = (await page.locator('[data-type="image"]').boundingBox())!;
	expect(box.x + box.width / 2).toBeCloseTo(at.x, 0);
	expect(box.y + box.height / 2).toBeCloseTo(at.y, 0);
});

test('pasting an image file adds it', async ({ page }) => {
	await page.getByTestId('canvas').focus();
	await dispatchWithFile(page, 'paste');
	await expect.poll(async () => (await list(page))[0]?.type).toBe('image');
});
