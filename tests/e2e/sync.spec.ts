import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeDrive } from '../../src/lib/storage/sync/fakeDrive';
import { createBoard, el, enableTestHooks, waitForHooks, waitForInitialView } from './helpers';

// Two browsers syncing through one fake Google Drive (the Drive API and Google's sign-in script
// are served by Playwright routes; the build has PUBLIC_GOOGLE_CLIENT_ID set, see the config).

const SAMPLE = 'tests/e2e/fixtures/sample.png';
const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': '*',
	'Access-Control-Allow-Methods': '*',
	'Access-Control-Expose-Headers': 'Location'
};
const GIS = `window.google = { accounts: { oauth2: {
	initTokenClient(c) {
		return { requestAccessToken() { setTimeout(() => c.callback({ access_token: 'token-1', expires_in: 3600 }), 10); } };
	},
	revoke(_t, done) { if (done) done(); }
} } };`;

async function useFakeGoogle(context: BrowserContext, drive: FakeDrive) {
	await context.route('https://accounts.google.com/gsi/client', (route) =>
		route.fulfill({ status: 200, contentType: 'text/javascript', body: GIS })
	);
	await context.route('https://www.googleapis.com/**', async (route) => {
		const req = route.request();
		if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
		const r = drive.handle({
			method: req.method(),
			url: req.url(),
			headers: await req.allHeaders(),
			body: new Uint8Array(req.postDataBuffer() ?? Buffer.alloc(0))
		});
		await route.fulfill({
			status: r.status,
			headers: { ...CORS, ...r.headers },
			body: typeof r.body === 'string' ? r.body : Buffer.from(r.body)
		});
	});
}

async function connect(page: Page) {
	await page.getByRole('button', { name: 'Settings' }).first().click();
	await page.getByRole('menuitem', { name: 'Sync with Google Drive…' }).click();
	const dialog = page.getByRole('dialog', { name: 'Google Drive sync' });
	await dialog.getByRole('button', { name: 'Connect Google Drive' }).click();
	await expect(dialog).toContainText('Syncing with ann@example.com');
	await expect(dialog.getByTestId('sync-state')).toContainText('Synced');
	await page.keyboard.press('Escape');
}

const list = (page: Page) => page.evaluate(() => window.__spacy!.list());
const add = (page: Page, e: object) =>
	page.evaluate((e) => window.__spacy!.createElements([e as never]), e);
const synced = (page: Page) =>
	expect(page.getByTestId('sync-indicator')).toHaveAttribute('data-state', 'synced', {
		timeout: 15_000
	});

async function syncNow(page: Page) {
	await page.getByTestId('sync-indicator').click();
	const dialog = page.getByRole('dialog', { name: 'Google Drive sync' });
	await dialog.getByRole('button', { name: 'Sync now' }).click();
	await expect(dialog.getByTestId('sync-state')).toContainText('Synced');
	await page.keyboard.press('Escape');
}

test('boards, titles and images sync between two browsers', async ({ page: a, browser }) => {
	test.setTimeout(90_000);
	const drive = new FakeDrive();
	await useFakeGoogle(a.context(), drive);
	await enableTestHooks(a);
	const id = await createBoard(a);
	await waitForHooks(a);
	await waitForInitialView(a);
	await add(a, { ...el.shape('s1', 0, 0) });
	await connect(a);
	await synced(a);

	const b = await (await browser.newContext()).newPage();
	await useFakeGoogle(b.context(), drive);
	await enableTestHooks(b);
	await b.addInitScript(() => localStorage.setItem('spacy:onboarded', 'true'));
	await b.goto('/');
	await connect(b);
	await expect(b.getByRole('link', { name: /Untitled board/ })).toBeVisible();

	await b.getByRole('link', { name: /Untitled board/ }).click();
	await b.waitForURL(`/board/${id}`);
	await waitForHooks(b);
	await expect.poll(async () => (await list(b)).map((e) => e.id)).toEqual(['s1']);

	// An image added on A arrives on B when B shows it.
	const chooser = a.waitForEvent('filechooser');
	await a.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: 'Image' }).click();
	await (await chooser).setFiles(SAMPLE);
	await expect
		.poll(() => drive.requests.filter((r) => r.startsWith('POST')).length, {
			timeout: 15_000
		})
		.toBeGreaterThanOrEqual(3);
	await expect
		.poll(() => [...drive.files.values()].some((f) => f.appProperties.kind === 'asset'), {
			timeout: 15_000
		})
		.toBe(true);
	await syncNow(b);
	const loaded = () =>
		b
			.locator('[data-type="image"] img')
			.evaluate((img: HTMLImageElement) => img.naturalWidth)
			.catch(() => 0);
	await expect.poll(loaded, { timeout: 15_000 }).toBe(64);

	// A rename on A reaches B's title.
	await a.getByRole('button', { name: /^Rename board/ }).click();
	await a.keyboard.press('ControlOrMeta+A');
	await a.keyboard.type('Roadmap');
	await a.keyboard.press('Enter');
	await expect
		.poll(
			async () => {
				await syncNow(b);
				return b.getByRole('button', { name: /^Rename board/ }).textContent();
			},
			{ timeout: 30_000 }
		)
		.toContain('Roadmap');

	// The sign-in lives in memory: after a reload sync waits for a click, which renews it.
	await b.reload();
	await expect(b.getByTestId('sync-indicator')).toHaveAttribute('data-state', 'signin');
	await b.getByTestId('sync-indicator').click();
	await synced(b);

	// Offline edits catch up.
	await a.context().setOffline(true);
	await add(a, { ...el.shape('offline', 300, 0) });
	await a.waitForTimeout(500);
	await a.context().setOffline(false);
	await a.evaluate(() => dispatchEvent(new Event('online')));
	await expect
		.poll(
			async () => {
				await syncNow(b);
				return (await list(b)).map((e) => e.id);
			},
			{ timeout: 30_000 }
		)
		.toContain('offline');
	await b.context().close();
});

test('disconnect keeps local boards and can delete the copy in Drive', async ({ page }) => {
	const drive = new FakeDrive();
	await useFakeGoogle(page.context(), drive);
	await createBoard(page);
	await connect(page);
	await synced(page);
	expect(drive.files.size).toBeGreaterThan(0);

	await page.getByTestId('sync-indicator').click();
	const dialog = page.getByRole('dialog', { name: 'Google Drive sync' });
	expect((await new AxeBuilder({ page }).include('[role=dialog]').analyze()).violations).toEqual(
		[]
	);
	await dialog.getByRole('button', { name: 'Disconnect…' }).click();
	await dialog.getByRole('checkbox', { name: /Also delete/ }).check();
	await dialog.getByRole('button', { name: 'Disconnect', exact: true }).click();
	await expect(page.getByTestId('sync-indicator')).toHaveCount(0);
	expect(drive.files.size).toBe(0);
	await page.goto('/');
	await expect(page.getByRole('link', { name: /Untitled board/ })).toBeVisible();
});
