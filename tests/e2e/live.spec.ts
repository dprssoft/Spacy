import { expect, test, type Browser, type Page } from '@playwright/test';
import { createBoard, el, enableTestHooks, waitForHooks, waitForInitialView } from './helpers';

// Two browsers on one live board through the local relay (`pnpm relay`, started by the config).

const SAMPLE = 'tests/e2e/fixtures/sample.png';

const list = (page: Page) => page.evaluate(() => window.__spacy!.list());
const add = (page: Page, e: object) =>
	page.evaluate((e) => window.__spacy!.createElements([e as never]), e);
const sticky = (id: string, x: number, y: number) => ({
	...el.shape(id, x, y),
	type: 'sticky',
	kind: undefined,
	text: id,
	color: '#ffe066',
	w: 180,
	h: 180
});

async function share(page: Page): Promise<string> {
	await page.getByTestId('share').click();
	await page.getByRole('button', { name: 'Share live' }).click();
	const link = await page.getByRole('textbox', { name: 'Share link' }).inputValue();
	expect(link).toMatch(/#live=/);
	await page.keyboard.press('Escape');
	return link;
}

async function join(browser: Browser, link: string): Promise<Page> {
	const context = await browser.newContext();
	const page = await context.newPage();
	await enableTestHooks(page);
	await page.addInitScript(() => localStorage.setItem('spacy:onboarded', 'true'));
	await page.goto(link);
	await waitForHooks(page);
	// The key is used once, then dropped from the address bar.
	expect(page.url()).not.toContain('#');
	return page;
}

test('two browsers edit one board live', async ({ page: a, browser, browserName }) => {
	// Headless Firefox here can't complete WebRTC's connectivity check between two contexts ("ICE
	// failed"), while Chromium does; the app code is the same for both.
	test.skip(browserName === 'firefox', 'WebRTC ICE fails between headless Firefox contexts');
	test.setTimeout(60_000);
	await enableTestHooks(a);
	const id = await createBoard(a);
	await waitForHooks(a);
	await waitForInitialView(a);
	await add(a, sticky('fromA', 0, 0));
	const link = await share(a);

	const b = await join(browser, link);
	expect(new URL(b.url()).pathname).toBe(`/board/${id}`);
	await expect.poll(async () => (await list(b)).map((e) => e.id)).toContain('fromA');
	await expect(a.getByTestId('live-peers')).toHaveText('2');

	// Presence: B on A's avatars, and B's pointer with its name on A's board.
	await expect(a.getByTestId('peer-avatar')).toHaveCount(1);
	const canvas = (await b.getByTestId('canvas').boundingBox())!;
	await b.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
	await b.mouse.move(canvas.x + canvas.width / 2 + 40, canvas.y + canvas.height / 2 + 30, {
		steps: 5
	});
	await expect(a.getByTestId('live-cursor')).toHaveText(/Guest \d+$/);
	await b.mouse.move(0, 0);

	await add(b, sticky('fromB', 300, 0));
	await expect
		.poll(async () => (await list(a)).map((e) => e.id).sort())
		.toEqual(['fromA', 'fromB']);

	// An image added on A is sent to B.
	const chooser = a.waitForEvent('filechooser');
	await a.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: 'Image' }).click();
	await (await chooser).setFiles(SAMPLE);
	const loaded = (p: Page) =>
		p
			.locator('[data-type="image"] img')
			.evaluate((img: HTMLImageElement) => img.naturalWidth)
			.catch(() => 0);
	await expect.poll(() => loaded(b), { timeout: 20_000 }).toBe(64);

	// Stop sharing: B is disconnected; later edits stay local.
	await a.getByTestId('share').click();
	await a.getByRole('button', { name: 'Stop sharing' }).click();
	await expect(b.getByTestId('share')).toContainText('Share');
	await add(a, sticky('afterStop', 600, 0));
	await b.waitForTimeout(1000);
	expect((await list(b)).map((e) => e.id)).not.toContain('afterStop');
	await b.context().close();
});

test('a timer started on one browser runs at the same time on the other', async ({
	page: a,
	browser,
	browserName
}) => {
	test.skip(browserName === 'firefox', 'WebRTC ICE fails between headless Firefox contexts');
	test.setTimeout(60_000);
	await enableTestHooks(a);
	await createBoard(a);
	await waitForHooks(a);
	await waitForInitialView(a);
	await add(a, {
		...el.shape('timer', -120, -120),
		type: 'widget',
		kind: 'timer',
		text: undefined,
		w: 240,
		h: 240,
		title: '',
		config: { mode: 'countdown', duration: 300, sound: false },
		state: { startedAt: null, elapsed: 0 }
	});
	const link = await share(a);
	const b = await join(browser, link);
	const time = (p: Page) => p.locator('[data-type="widget"] text').first().textContent();
	await expect.poll(() => time(b)).toBe('5:00');

	await a.evaluate(() => window.__spacy!.ctx.widgets.run('timer', 'toggle'));
	await expect.poll(() => time(b), { timeout: 10_000 }).toMatch(/^4:5\d$/);
	// Same time on both (read together; the display has whole seconds).
	const seconds = (t: string | null) => {
		const [m, s] = (t ?? '0:0').split(':').map(Number);
		return m! * 60 + s!;
	};
	const [ta, tb] = await Promise.all([time(a), time(b)]);
	expect(Math.abs(seconds(ta) - seconds(tb))).toBeLessThanOrEqual(1);
	// Undo on B doesn't stop A's timer.
	await b.getByTestId('canvas').focus();
	await b.keyboard.press('ControlOrMeta+z');
	await b.waitForTimeout(500);
	expect(await a.evaluate(() => window.__spacy!.list().some((e) => e.id === 'timer'))).toBe(true);
	await b.context().close();
});
