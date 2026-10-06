import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createBoard, el, enableTestHooks, waitForHooks, waitForInitialView } from './helpers';
import { Touch } from './touch';

test.beforeEach(async ({ page, context }) => {
	await context.route('https://www.youtube-nocookie.com/embed/**', (r) =>
		r.fulfill({
			contentType: 'text/html',
			body: readFileSync(new URL('./fixtures/fake-youtube.html', import.meta.url))
		})
	);
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await waitForInitialView(page);
});

async function canvasCenter(page: Page) {
	const b = (await page.getByTestId('canvas').boundingBox())!;
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
const add = (page: Page, e: object) =>
	page.evaluate((e) => window.__spacy!.createElements([e as never]), e);
const list = (page: Page) => page.evaluate(() => window.__spacy!.list());

test('long-press an element opens its menu; long-press empty canvas opens the canvas menu', async ({
	page
}) => {
	await add(page, { ...el.shape('s', -80, -50), text: 'Hold me' });
	const c = await canvasCenter(page);
	const t = new Touch(page);
	await t.drag(c, c, { holdMs: 700, steps: 1 });
	const menu = page.getByRole('menu');
	await expect(menu.getByRole('menuitem', { name: /Duplicate/ })).toBeVisible();
	expect(
		(await menu.getByRole('menuitem', { name: /Duplicate/ }).boundingBox())!.height
	).toBeGreaterThanOrEqual(43.5);
	await menu.getByRole('menuitem', { name: /Duplicate/ }).click();
	await expect.poll(async () => (await list(page)).length).toBe(2);

	const empty = { x: c.x, y: c.y + 220 };
	await t.drag(empty, empty, { holdMs: 700, steps: 1 });
	await expect(page.getByRole('menuitem', { name: /Select all/ })).toBeVisible();
	await expect(page.getByRole('menuitem', { name: /Paste/ })).toBeVisible();
});

test('styles open in a bottom sheet that applies and swipes closed', async ({ page }) => {
	await add(page, el.shape('s', -80, -50));
	const c = await canvasCenter(page);
	await new Touch(page).tap(c);
	const bar = page.getByTestId('style-popover');
	await expect(bar).toBeVisible();
	const barBox = (await bar.boundingBox())!;
	const canvas = (await page.getByTestId('canvas').boundingBox())!;
	expect(barBox.y + barBox.height).toBeGreaterThan(canvas.y + canvas.height - 40); // docked low

	await page.getByTestId('style-fill').click();
	const sheet = page.getByTestId('style-sheet');
	await expect(sheet).toBeVisible();
	expect((await sheet.boundingBox())!.width).toBeGreaterThan(page.viewportSize()!.width - 2);
	await sheet.getByRole('radio', { name: 'Blue', exact: true }).click();
	await expect.poll(async () => (await list(page))[0]!.style.fill).not.toBe('#ffffff');
	const results = await new AxeBuilder({ page }).include('[data-testid="style-sheet"]').analyze();
	expect(results.violations).toEqual([]);

	const handle = (await page.getByTestId('sheet-handle').boundingBox())!;
	await new Touch(page).drag(
		{ x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 },
		{ x: handle.x + handle.width / 2, y: handle.y + 200 }
	);
	await expect(sheet).toBeHidden();
});

test('editing stays above the on-screen keyboard', async ({ page }) => {
	// Low on the screen, where a keyboard would cover it.
	await add(page, { ...el.shape('s', -80, 220), text: 'Low' });
	const box = (await page.locator('[data-element-id="s"]').boundingBox())!;
	await page.evaluate(() => window.__spacy!.keyboard(320));
	await new Touch(page).doubleTap({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
	const editor = page.getByRole('textbox', { name: 'Edit text' });
	await expect(editor).toBeFocused();
	const visibleBottom = page.viewportSize()!.height - 320;
	await expect
		.poll(async () => (await page.locator('[data-element-id="s"]').boundingBox())!.y + box.height)
		.toBeLessThanOrEqual(visibleBottom);
	await page.keyboard.type(' text');
	await page.keyboard.press('Escape');
	await expect.poll(async () => ((await list(page))[0] as { text?: string }).text).toBe('Low text');
	// The tools stepped aside while editing and are back now.
	await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeVisible();
	await page.evaluate(() => window.__spacy!.keyboard(null));
});

test('a finger draws with the pen; right after a stylus, fingers draw nothing', async ({
	page
}) => {
	await page.getByRole('button', { name: /^Pen/ }).click();
	const c = await canvasCenter(page);
	const t = new Touch(page);
	await t.drag({ x: c.x - 80, y: c.y }, { x: c.x + 80, y: c.y + 40 });
	await expect
		.poll(async () => (await list(page)).filter((e) => e.type === 'stroke').length)
		.toBe(1);

	const cdp = await page.context().newCDPSession(page);
	const pen = (type: 'mousePressed' | 'mouseReleased', x: number, y: number) =>
		cdp.send('Input.dispatchMouseEvent', {
			type,
			x,
			y,
			button: 'left',
			clickCount: 1,
			pointerType: 'pen'
		});
	// The stylus lifts; a palm landing right after (within a second) must not draw.
	await pen('mousePressed', c.x - 100, c.y - 150);
	await pen('mouseReleased', c.x - 100, c.y - 150);
	await t.drag({ x: c.x - 80, y: c.y + 100 }, { x: c.x + 80, y: c.y + 140 }); // the palm
	// The palm's 160 px line was never drawn: the only long stroke is the first one (the stylus
	// press may leave a dot).
	const long = (await list(page)).filter((e) => e.type === 'stroke' && e.w > 100);
	expect(long).toHaveLength(1);
});

test('media controls are touch-sized and play/pause by tap', async ({ page }) => {
	await page.evaluate(() => {
		const dt = new DataTransfer();
		dt.setData('text/plain', 'https://youtu.be/dQw4w9WgXcQ');
		// Firefox drops `clipboardData` given to a synthetic event's constructor.
		const e = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
		Object.defineProperty(e, 'clipboardData', { value: dt });
		document.dispatchEvent(e);
	});
	const media = page.locator('[data-type=media]');
	await expect(media).toHaveCount(1);
	const box = (await media.boundingBox())!;
	await new Touch(page).doubleTap({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
	const controls = page.getByTestId('media-controls');
	await expect(controls).toBeVisible();
	const toggle = controls.getByTestId('media-toggle');
	expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
	await expect(controls.getByTestId('media-scrubber')).toBeVisible();
	const id = await page.evaluate(() => [...window.__spacy!.ctx.playback.playing][0]!);
	const playing = () =>
		page.evaluate((id) => window.__spacy!.ctx.playback.controllers.get(id)?.state.playing, id);
	await expect.poll(playing).toBe(true);
	await toggle.tap();
	await expect.poll(playing).toBe(false);
	const results = await new AxeBuilder({ page })
		.include('[data-testid="media-controls"]')
		.analyze();
	expect(results.violations).toEqual([]);
});

test('a finger draws again once the stylus has rested a while', async ({ page }) => {
	await page.getByRole('button', { name: /^Pen/ }).click();
	const c = await canvasCenter(page);
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Input.dispatchMouseEvent', {
		type: 'mousePressed',
		x: c.x,
		y: c.y - 150,
		button: 'left',
		clickCount: 1,
		pointerType: 'pen'
	});
	await cdp.send('Input.dispatchMouseEvent', {
		type: 'mouseReleased',
		x: c.x,
		y: c.y - 150,
		button: 'left',
		clickCount: 1,
		pointerType: 'pen'
	});
	await page.waitForTimeout(1100);
	await new Touch(page).drag({ x: c.x - 80, y: c.y }, { x: c.x + 80, y: c.y + 40 });
	await expect
		.poll(async () => (await list(page)).filter((e) => e.type === 'stroke' && e.w > 100).length)
		.toBe(1);
});
