import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { createBoard, enableTestHooks, waitForHooks, waitForInitialView } from './helpers';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await waitForInitialView(page);
	await page.keyboard.press('Shift+T');
	await page.getByRole('button', { name: 'Scene cards template' }).click();
	await expect(page.locator('[data-type=doccard]')).toHaveCount(12);
});

async function openCompile(page: Page) {
	await page.getByRole('button', { name: /^Export/ }).click();
	await page.getByRole('menuitem', { name: 'Compile manuscript…' }).click();
	const dialog = page.getByRole('dialog', { name: 'Compile manuscript' });
	await expect(dialog).toBeVisible();
	return dialog;
}

test('compile to Markdown: chapters in outline order with the scene text', async ({ page }) => {
	const dialog = await openCompile(page);
	await expect(dialog.getByTestId('compile-summary')).toContainText('3 chapters');
	await dialog.getByLabel('Markdown (.md)').check();
	await dialog.getByLabel('Author').fill('A. Writer');
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		dialog.getByRole('button', { name: 'Download' }).click()
	]);
	expect(download.suggestedFilename()).toBe('untitled-board.md');
	const md = readFileSync((await download.path())!, 'utf8');
	expect(md.startsWith('# Untitled board\n\n*A. Writer*')).toBe(true);
	const h = [...md.matchAll(/^# (Chapter \d)$/gm)].map((m) => m[1]);
	expect(h).toEqual(['Chapter 1', 'Chapter 2', 'Chapter 3']);
	expect(md).toContain('### Scene 1');
	expect(md).toContain('Goal:');
	expect(md.indexOf('### Scene 4')).toBeLessThan(md.indexOf('# Chapter 2'));
});

test('compile to Word and to the print view; leaving a chapter out', async ({ page }) => {
	const dialog = await openCompile(page);
	await dialog.getByLabel('Word (.docx)').check();
	await dialog.getByRole('checkbox', { name: 'Chapter 3' }).uncheck();
	await expect(dialog.getByTestId('compile-summary')).toContainText('2 chapters');
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		dialog.getByRole('button', { name: 'Download' }).click()
	]);
	expect(download.suggestedFilename()).toBe('untitled-board.docx');
	const bytes = readFileSync((await download.path())!);
	expect(bytes.subarray(0, 2).toString()).toBe('PK');
	expect(bytes.includes(Buffer.from('word/document.xml'))).toBe(true);
	expect(bytes.includes(Buffer.from('Chapter 2'))).toBe(true);
	expect(bytes.includes(Buffer.from('Chapter 3'))).toBe(false);

	await dialog.getByLabel('Print or save as PDF').check();
	await page.evaluate(() => {
		// Headless print would block: replace it inside the print frame when it loads.
		const frame = document.querySelector<HTMLIFrameElement>('[data-testid="print-frame"]')!;
		frame.addEventListener('load', () => (frame.contentWindow!.print = () => {}), {
			capture: true
		});
	});
	await dialog.getByRole('button', { name: 'Print' }).click();
	const frame = page.frameLocator('[data-testid="print-frame"]');
	await expect(frame.locator('section.chapter')).toHaveCount(2);
	await expect(frame.locator('h1').first()).toHaveText('Untitled board');
});
