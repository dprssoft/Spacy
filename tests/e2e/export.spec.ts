import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { createBoard, el, enableTestHooks, waitForHooks } from './helpers';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await page.evaluate(
		(els) => window.__spacy!.createElements(els as never),
		[
			el.shape('a', -300, -80, { text: 'Start' }),
			{
				...el.shape('b', 60, -80, { text: 'Sticky <&> note' }),
				type: 'sticky',
				kind: undefined,
				color: '#ffe066',
				w: 180,
				h: 180
			}
		]
	);
});

async function download(page: Page, format: 'PNG' | 'JPG' | 'WebP' | 'SVG') {
	await page.getByRole('button', { name: 'Export' }).click();
	await page.getByRole('menuitem', { name: `${format}…` }).click();
	const dialog = page.getByRole('dialog', { name: 'Export image' });
	await expect(dialog.getByRole('img', { name: 'Export preview' })).toBeVisible();
	const [file] = await Promise.all([
		page.waitForEvent('download'),
		dialog.getByRole('button', { name: 'Download' }).click()
	]);
	return file;
}

test('PNG export downloads an image', async ({ page }) => {
	const file = await download(page, 'PNG');
	expect(file.suggestedFilename()).toBe('untitled-board.png');
	const bytes = await readFile((await file.path())!);
	expect(bytes.length).toBeGreaterThan(1024);
	expect(bytes.subarray(1, 4).toString()).toBe('PNG');
});

test('JPG export has no transparency to offer', async ({ page }) => {
	const file = await download(page, 'JPG');
	expect(file.suggestedFilename()).toBe('untitled-board.jpg');
	const bytes = await readFile((await file.path())!);
	expect(bytes.subarray(0, 3).toString('hex')).toBe('ffd8ff');

	await page.getByRole('button', { name: 'Export' }).click();
	await page.getByRole('menuitem', { name: 'JPG…' }).click();
	const dialog = page.getByRole('dialog', { name: 'Export image' });
	await expect(dialog.getByRole('radio', { name: 'Transparent' })).toBeDisabled();
	await expect(dialog.getByRole('radio', { name: 'White' })).toHaveAttribute(
		'aria-checked',
		'true'
	);
});

test('WebP export downloads a WebP file', async ({ page, browserName }) => {
	test.skip(browserName === 'webkit', 'Safari has no WebP encoder: it falls back to PNG');
	const file = await download(page, 'WebP');
	expect(file.suggestedFilename()).toBe('untitled-board.webp');
	const bytes = await readFile((await file.path())!);
	expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
	expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
});

test('Ctrl+C copies a picture for other apps, and the objects for Spacy', async ({
	page,
	context,
	browserName
}) => {
	test.skip(browserName !== 'chromium', 'only Chromium lets a test read the clipboard');
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	const box = (await page.locator('[data-element-id="a"]').boundingBox())!;
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await page.keyboard.press('ControlOrMeta+c');
	const clipboard = () =>
		page.evaluate(async () => {
			const [item] = await navigator.clipboard.read();
			if (!item?.types.includes('image/png')) return null;
			const bitmap = await createImageBitmap(await item.getType('image/png'));
			const text = await (await item.getType('text/plain')).text();
			return { w: bitmap.width, text };
		});
	await expect.poll(clipboard).not.toBeNull();
	const copied = (await clipboard())!;
	expect(copied.w).toBeGreaterThan(box.width); // 2× scale
	expect(copied.text.startsWith('SPACY-CLIPBOARD:')).toBe(true);

	const count = () => page.evaluate(() => window.__spacy!.list().length);
	const before = await count();
	await page.keyboard.press('ControlOrMeta+v');
	await expect.poll(count).toBe(before + 1);
	const types = await page.evaluate(() => window.__spacy!.list().map((e) => e.type));
	expect(types).not.toContain('image');
});

test('Ctrl+Shift+C bakes the selection: it pastes back as an image', async ({
	page,
	context,
	browserName
}) => {
	test.skip(browserName !== 'chromium', 'only Chromium lets a test read the clipboard');
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	const box = (await page.locator('[data-element-id="a"]').boundingBox())!;
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await page.keyboard.press('ControlOrMeta+Shift+c');
	await expect(page.getByText('Image copied')).toBeVisible();
	await page.keyboard.press('ControlOrMeta+v');
	await expect
		.poll(() => page.evaluate(() => window.__spacy!.list().map((e) => e.type)))
		.toContain('image');
	await expect(page.getByTestId('kind-badge')).toHaveAttribute('data-kind', 'image');
});

test('the floating bar exports the selection', async ({ page }) => {
	const box = (await page.locator('[data-element-id="a"]').boundingBox())!;
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await page.getByTestId('style-export').click();
	const dialog = page.getByRole('dialog', { name: 'Export image' });
	await expect(dialog.getByRole('radio', { name: 'Selection' })).toHaveAttribute(
		'aria-checked',
		'true'
	);
});

test('the export dialog copies the image too', async ({ page, context, browserName }) => {
	test.skip(browserName !== 'chromium', 'only Chromium lets a test read the clipboard');
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.getByRole('button', { name: 'Export' }).click();
	await page.getByRole('menuitem', { name: 'WebP…' }).click();
	const dialog = page.getByRole('dialog', { name: 'Export image' });
	await dialog.getByRole('button', { name: 'Copy image' }).click();
	await expect(page.getByText('Image copied')).toBeVisible();
	await expect(dialog).toBeHidden();
});

test('SVG export downloads valid SVG with escaped text', async ({ page }) => {
	const file = await download(page, 'SVG');
	const svg = await readFile((await file.path())!, 'utf8');
	expect(svg.startsWith('<svg')).toBe(true);
	expect(svg).toContain('Sticky &#60;&#38;&#62; note');
	expect(svg).not.toContain('foreignObject');
});

test('selection export is offered from the context menu', async ({ page }) => {
	const box = (await page.locator('[data-element-id="a"]').boundingBox())!;
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
	await page.getByRole('menuitem', { name: 'Export selection…' }).click();
	const dialog = page.getByRole('dialog', { name: 'Export image' });
	await expect(dialog.getByRole('radio', { name: 'Selection' })).toHaveAttribute(
		'aria-checked',
		'true'
	);
	const [file] = await Promise.all([
		page.waitForEvent('download'),
		dialog.getByRole('button', { name: 'Download' }).click()
	]);
	expect(file.suggestedFilename()).toBe('untitled-board-selection.png');
});

test('leaving the board saves a thumbnail for the start page', async ({ page }) => {
	await page
		.getByRole('link', { name: /boards|home/i })
		.first()
		.click();
	await expect(page.locator('article[data-board-id] img').first()).toBeVisible({ timeout: 2000 });
});
