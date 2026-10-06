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

async function download(page: Page, format: 'PNG' | 'SVG') {
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
