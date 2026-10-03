import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { createBoard, enableTestHooks, waitForHooks, waitForInitialView } from './helpers';

const WEBM = readFileSync(new URL('./fixtures/sample.webm', import.meta.url));
const YT = 'dQw4w9WgXcQ';
const CLIP = 'https://media.example/clips/demo.webm';

/** Requests leaving the app's own origin (nothing may go out before pressing play). */
function thirdParty(page: Page): string[] {
	const out: string[] = [];
	page.on('request', (r) => {
		const u = new URL(r.url());
		if (u.protocol.startsWith('http') && u.host !== 'localhost:4173') out.push(r.url());
	});
	return out;
}

test.beforeEach(async ({ page, context }) => {
	// Network-free: a stand-in for the YouTube player and a local file for the video link.
	await context.route('https://www.youtube-nocookie.com/**', (r) =>
		r.fulfill({
			contentType: 'text/html',
			body: '<!doctype html><title>player</title><p>player</p>'
		})
	);
	await context.route(CLIP, (r) => r.fulfill({ contentType: 'video/webm', body: WEBM }));
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await waitForInitialView(page);
});

async function paste(page: Page, text: string) {
	await page.getByTestId('canvas').focus();
	await page.evaluate((t) => {
		const dt = new DataTransfer();
		dt.setData('text/plain', t);
		document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
	}, text);
}

const media = (page: Page) => page.locator('[data-type=media]');

test('a pasted YouTube link becomes a poster, plays in place, and keeps playing after leaving it', async ({
	page
}) => {
	const outside = thirdParty(page);
	await paste(page, `https://youtu.be/${YT}?t=42`);
	await expect(media(page)).toHaveCount(1);
	await expect(media(page).locator('[data-media-title]')).toHaveText('YouTube video');
	await expect(media(page).locator('iframe')).toHaveCount(0);
	expect(outside).toEqual([]);

	const box = (await media(page).boundingBox())!;
	await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
	const frame = media(page).locator('iframe');
	await expect(frame).toHaveAttribute(
		'src',
		`https://www.youtube-nocookie.com/embed/${YT}?autoplay=1&rel=0&playsinline=1&start=42`
	);

	// Leaving interaction keeps it playing; Stop returns to the poster.
	await page.keyboard.press('Escape');
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await expect(frame).toHaveCount(1);
	await page.getByTestId('media-play').click();
	await expect(media(page).locator('iframe')).toHaveCount(0);
	await expect(media(page).locator('[data-media-title]')).toBeVisible();

	// One undo removes the pasted element.
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('Escape');
	await page.keyboard.press('ControlOrMeta+z');
	await expect(media(page)).toHaveCount(0);
});

test('Insert → Media adds a video link that plays, stays mounted off screen, and stops on delete', async ({
	page
}) => {
	await page.getByRole('button', { name: 'Media', exact: true }).click();
	const input = page.getByRole('textbox', { name: 'Media link' });
	await input.fill('https://example.com/page');
	await page.getByRole('button', { name: 'Add', exact: true }).click();
	await expect(page.getByText('Paste a YouTube, Vimeo, audio or video link')).toBeVisible();
	await input.fill(CLIP);
	await page.getByRole('button', { name: 'Add', exact: true }).click();
	await expect(media(page)).toHaveCount(1);
	await expect(media(page).locator('[data-media-title]')).toHaveText('demo.webm');

	// Enter on the selected element plays it.
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('Enter');
	const video = media(page).locator('video');
	await expect(video).toHaveCount(1);
	await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThan(0);
	await page.keyboard.press('Escape');

	// Far out of view, it stays mounted (the sound goes on).
	await page.evaluate(() => {
		const v = window.__smthng!.ctx.viewport;
		v.set({ ...v.vp, x: v.vp.x + 5000 });
	});
	await page.waitForTimeout(300);
	await expect(video).toHaveCount(1);

	// Deleting it stops it.
	await page.evaluate(() => {
		const ctx = window.__smthng!.ctx;
		const id = [...ctx.playback.playing][0]!;
		window.__smthng!.ctx.selection.set([id]);
	});
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('Delete');
	await expect(media(page)).toHaveCount(0);
	expect(await page.evaluate(() => window.__smthng!.ctx.playback.playing.size)).toBe(0);
});

test('switching page stops playback', async ({ page }) => {
	await paste(page, CLIP);
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('Enter');
	await expect(media(page).locator('video')).toHaveCount(1);
	await page.keyboard.press('Escape');

	await page.evaluate(() => {
		const { pages } = window.__smthng!.ctx;
		const first = pages.current;
		pages.select(pages.add().id);
		pages.select(first);
	});
	await expect(media(page)).toHaveCount(1);
	await expect(media(page).locator('video')).toHaveCount(0);
	expect(await page.evaluate(() => window.__smthng!.ctx.playback.playing.size)).toBe(0);
});
