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
