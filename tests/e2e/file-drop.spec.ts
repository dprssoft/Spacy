import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { createBoard, enableTestHooks, waitForHooks, waitForInitialView } from './helpers';

const DOCX = new URL('./fixtures/sample.docx', import.meta.url);

type DropFile = { name: string; type: string; bytes: number[] };

async function dropFiles(page: Page, files: DropFile[]) {
	const box = (await page.getByTestId('canvas').boundingBox())!;
	const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	await page.evaluate(
		({ files, at }) => {
			const dt = new DataTransfer();
			for (const f of files)
				dt.items.add(new File([new Uint8Array(f.bytes)], f.name, { type: f.type }));
			const target = document.querySelector('[data-testid=canvas]')!;
			const init = {
				dataTransfer: dt,
				bubbles: true,
				cancelable: true,
				clientX: at.x,
				clientY: at.y
			};
			target.dispatchEvent(new DragEvent('dragover', init));
			target.dispatchEvent(new DragEvent('drop', init));
		},
		{ files, at }
	);
}

const text = (name: string, content: string, type = ''): DropFile => ({
	name,
	type,
	bytes: [...new TextEncoder().encode(content)]
});

const docCards = (page: Page) =>
	page.evaluate(() =>
		window
			.__smthng!.list()
			.filter((e) => e.type === 'doccard')
			.map((e) => (e as { title: string }).title)
	);

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await waitForInitialView(page);
});

test('a dropped Markdown file becomes a formatted doc card', async ({ page }) => {
	await dropFiles(page, [
		text('Plan.md', '# Launch plan\n\nShip **on Friday**.\n\n- [x] Draft\n- [ ] Review')
	]);
	await expect.poll(() => docCards(page)).toEqual(['Plan']);
	const body = page.locator('[data-doccard-body] .ProseMirror');
	await expect(body.locator('h1')).toHaveText('Launch plan');
	await expect(body.locator('strong')).toHaveText('on Friday');
	await expect(body.locator('ul[data-type=taskList] li')).toHaveCount(2);
	// One undo step removes the card and its content.
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('Escape');
	await page.keyboard.press('ControlOrMeta+z');
	await expect.poll(() => docCards(page)).toEqual([]);
});

test('text and Word files become doc cards; unsupported files are ignored', async ({ page }) => {
	await dropFiles(page, [
		text('notes.txt', 'First line\nsecond line\n\nNext paragraph', 'text/plain'),
		{ name: 'Report.docx', type: '', bytes: [...readFileSync(DOCX)] },
		text('data.bin', 'binary', 'application/octet-stream')
	]);
	await expect.poll(() => docCards(page)).toEqual(['notes', 'Report']);
	const bodies = page.locator('[data-doccard-body] .ProseMirror');
	await expect(bodies).toHaveCount(2);
	await expect(page.locator('[data-doccard-body] .ProseMirror p').first()).toContainText(
		'second line'
	);
	await expect(page.getByRole('heading', { name: 'Quarterly report' })).toBeVisible();
	await expect(page.locator('[data-doccard-body] strong', { hasText: '12%' })).toBeVisible();
	// Both cards are selected after the drop.
	expect(await page.evaluate(() => window.__smthng!.ctx.selection.ids.size)).toBe(2);
});

test('a file that is not really a Word document shows an error', async ({ page }) => {
	await dropFiles(page, [text('broken.docx', 'not a zip')]);
	await expect(page.getByText('broken.docx: could not read the Word document')).toBeVisible();
	expect(await docCards(page)).toEqual([]);
});
