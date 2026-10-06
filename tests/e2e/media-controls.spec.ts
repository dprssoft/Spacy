import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createBoard, enableTestHooks, waitForHooks, waitForInitialView } from './helpers';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
const YT = 'dQw4w9WgXcQ';
const SILENT = 'AAAAAAAAAAA'; // a YouTube id whose stand-in player never answers

test.beforeEach(async ({ page, context }) => {
	await context.route('https://www.youtube-nocookie.com/embed/**', (r) =>
		r.fulfill({
			contentType: 'text/html',
			body: r.request().url().includes(SILENT)
				? '<!doctype html><p>silent</p>'
				: fixture('fake-youtube.html')
		})
	);
	await context.route('https://player.vimeo.com/video/**', (r) =>
		r.fulfill({ contentType: 'text/html', body: fixture('fake-vimeo.html') })
	);
	await context.route('https://media.example/**', (r) =>
		r.fulfill({ contentType: 'video/webm', body: fixture('sample.webm') })
	);
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await waitForInitialView(page);
});

/** Pastes a media link at a world point and starts it (Enter); returns its id. */
async function addPlaying(page: Page, url: string, at = { x: 0, y: 0 }): Promise<string> {
	const id = await page.evaluate(
		({ url, at }) => {
			const ctx = window.__spacy!.ctx;
			ctx.pointer = at;
			const dt = new DataTransfer();
			dt.setData('text/plain', url);
			// Firefox drops `clipboardData` given to a synthetic event's constructor.
			const e = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
			Object.defineProperty(e, 'clipboardData', { value: dt });
			document.dispatchEvent(e);
			return ctx.selection.single!;
		},
		{ url, at }
	);
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('Enter');
	await page.keyboard.press('Escape');
	await expect(bar(page, id)).toBeVisible();
	return id;
}

const bar = (page: Page, id: string) =>
	page.locator(`[data-media-bar="${id}"] [data-testid=media-controls]`);
const state = (page: Page, id: string) =>
	page.evaluate((id) => {
		const c = window.__spacy!.ctx.playback.controllers.get(id);
		return c ? { ...c.state } : null;
	}, id);
const media = (page: Page, id: string) =>
	page.evaluate(
		(id) => window.__spacy!.ctx.store.get(id) as unknown as Record<string, unknown>,
		id
	);

test('one set of controls drives YouTube: play/pause, seek, time', async ({ page }) => {
	const id = await addPlaying(page, `https://youtu.be/${YT}`);
	const controls = bar(page, id);
	await expect.poll(async () => (await state(page, id))?.playing).toBe(true);
	await controls.getByRole('button', { name: 'Pause' }).click();
	await expect.poll(async () => (await state(page, id))?.playing).toBe(false);

	const scrub = controls.getByTestId('media-scrubber');
	const box = (await scrub.boundingBox())!;
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await expect.poll(async () => Math.round((await state(page, id))!.time)).toBeGreaterThan(140);
	await expect(controls.getByTestId('media-time')).toContainText('/ 5:00');
	await expect(scrub).toHaveAttribute('aria-valuetext', /of 5:00$/);
});

test('clip and loop: set start and end, it loops, and undo restores the clip', async ({ page }) => {
	const id = await addPlaying(page, `https://youtu.be/${YT}`);
	const controls = bar(page, id);
	const more = async (item: string) => {
		await controls.getByRole('button', { name: 'More media options' }).click();
		await page
			.getByRole('menuitem', { name: item })
			.or(page.getByRole('menuitemcheckbox', { name: item }))
			.click();
	};
	await page.evaluate((id) => window.__spacy!.ctx.playback.controllers.get(id)!.seek(100), id);
	await more('Set start here');
	await page.evaluate((id) => window.__spacy!.ctx.playback.controllers.get(id)!.seek(110), id);
	await more('Set end here');
	await more('Loop');
	const el = await media(page, id);
	expect(el.start).toBeGreaterThanOrEqual(100);
	expect(el.end).toBeGreaterThanOrEqual(110);
	expect(el.loop).toBe(true);
	await expect(controls.locator('[data-clip-start]')).toBeVisible();
	await expect(controls.locator('[data-clip-end]')).toBeVisible();

	// Playing past the end jumps back to the start.
	if (!(await state(page, id))!.playing)
		await controls.getByRole('button', { name: 'Play' }).click();
	await expect
		.poll(async () => (await state(page, id))!.time, { timeout: 10_000 })
		.toBeLessThan(108);
	await expect
		.poll(async () => (await state(page, id))!.time, { timeout: 10_000 })
		.toBeGreaterThan(108);
	await expect
		.poll(async () => (await state(page, id))!.time, { timeout: 10_000 })
		.toBeLessThan(108);

	await page.getByTestId('canvas').focus();
	await page.keyboard.press('ControlOrMeta+z'); // loop off
	await page.keyboard.press('ControlOrMeta+z'); // end cleared
	expect(await media(page, id)).toMatchObject({ loop: false, end: null });
});

test('volume and speed are personal: kept after a reload, never on the board', async ({ page }) => {
	const id = await addPlaying(page, `https://youtu.be/${YT}`);
	const controls = bar(page, id);
	await controls.getByRole('button', { name: 'Mute' }).click();
	await controls.getByRole('button', { name: /^Speed/ }).click();
	await page.getByRole('menuitemradio', { name: '1.5×' }).click();
	await expect.poll(async () => (await state(page, id))?.rate).toBe(1.5);
	const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('spacy:media') ?? '{}'));
	expect(prefs).toMatchObject({ muted: true, rate: 1.5 });
	expect(Object.keys(await media(page, id))).not.toContain('rate');

	await page.reload();
	await waitForHooks(page);
	await page.evaluate((id) => {
		const ctx = window.__spacy!.ctx;
		ctx.selection.set([id]);
		ctx.playback.play(id);
	}, id);
	await expect.poll(async () => (await state(page, id))?.rate).toBe(1.5);
	expect((await state(page, id))?.muted).toBe(true);
});

test('starting a second media pauses the first; Vimeo works too and hides speed when refused', async ({
	page
}) => {
	const a = await addPlaying(page, `https://youtu.be/${YT}`, { x: -300, y: 0 });
	await expect.poll(async () => (await state(page, a))?.playing).toBe(true);
	const b = await addPlaying(page, 'https://vimeo.com/76979871', { x: 300, y: 0 });
	await expect.poll(async () => (await state(page, b))?.playing).toBe(true);
	await expect.poll(async () => (await state(page, a))?.playing).toBe(false);

	await bar(page, b)
		.getByRole('button', { name: /^Speed/ })
		.click();
	await page.getByRole('menuitemradio', { name: '2×' }).click();
	await expect(bar(page, b).getByRole('button', { name: /^Speed/ })).toHaveCount(0);
});

test('keyboard: Space, arrows and M on the selected playing media; typing elsewhere is untouched', async ({
	page
}) => {
	const id = await addPlaying(page, `https://youtu.be/${YT}`);
	await page.getByTestId('canvas').focus();
	await expect.poll(async () => (await state(page, id))?.playing).toBe(true);
	await page.keyboard.press('Space');
	await expect.poll(async () => (await state(page, id))?.playing).toBe(false);
	const t = (await state(page, id))!.time;
	await page.keyboard.press('ArrowRight');
	await expect.poll(async () => Math.round((await state(page, id))!.time)).toBe(Math.round(t + 5));
	await page.keyboard.press('m');
	await expect.poll(async () => (await state(page, id))?.muted).toBe(true);
	// The element itself didn't move (arrows seek instead of nudging).
	expect((await media(page, id)).x).toBe(-240);

	// A doc card still gets its spaces.
	await page.keyboard.press('n');
	const canvas = (await page.getByTestId('canvas').boundingBox())!;
	await page.mouse.click(canvas.x + 120, canvas.y + 120);
	await expect(page.locator('[data-doccard-body] .ProseMirror')).toBeFocused();
	await page.keyboard.type('two words');
	await expect(page.locator('[data-doccard-body] .ProseMirror')).toHaveText('two words');
});

test('controls keep their size at any zoom and pass axe', async ({ page }) => {
	const id = await addPlaying(page, `https://youtu.be/${YT}`);
	const height = async () => (await bar(page, id).boundingBox())!.height;
	const at100 = await height();
	for (const zoom of [0.25, 2]) {
		await page.evaluate((z) => {
			const v = window.__spacy!.ctx.viewport;
			v.set({ zoom: z, x: v.size.w / 2, y: v.size.h / 3 });
		}, zoom);
		await expect(bar(page, id)).toBeVisible();
		expect(await height()).toBeCloseTo(at100, 0);
	}
	const results = await new AxeBuilder({ page }).include(`[data-media-bar="${id}"]`).analyze();
	expect(results.violations).toEqual([]);
});

test('a player that never answers falls back to its own controls', async ({ page }) => {
	const id = await addPlaying(page, `https://youtu.be/${SILENT}`).catch(() => null);
	const mediaId = id ?? (await page.evaluate(() => window.__spacy!.ctx.selection.single!));
	const frame = page.locator(`[data-element-id="${mediaId}"] iframe`);
	await expect(frame).toHaveAttribute('src', /controls=0/);
	await expect(page.getByText('Using the player’s controls')).toBeVisible({ timeout: 8000 });
	await expect(frame).not.toHaveAttribute('src', /controls=0/);
});
