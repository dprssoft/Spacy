import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { createBoard, enableTestHooks, waitForHooks } from './helpers';

const EXPECTED = '# Untitled\n\n## Goals\n\n- [ ] write docs\n- [x] ship **it**\n';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	const box = (await page.getByTestId('canvas').boundingBox())!;
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('n');
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await expect(page.locator('[data-doccard-body] .ProseMirror')).toBeFocused();
	await page.keyboard.type('## Goals');
	await page.keyboard.press('Enter');
	await page.keyboard.type('[ ] write docs');
	await page.keyboard.press('Enter');
	await page.keyboard.type('ship **it** ');
	await page.keyboard.press('Backspace');
	// Tick the second checkbox (the card is in edit mode).
	await page.locator('[data-doccard-body] input[type=checkbox]').nth(1).check();
	await page.keyboard.press('Escape');
});

test('"Download .md" saves the card as Markdown', async ({ page }) => {
	await page.getByRole('button', { name: 'Doc card options' }).click();
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('menuitem', { name: 'Download .md' }).click()
	]);
	expect(download.suggestedFilename()).toBe('untitled.md');
	expect(await readFile((await download.path())!, 'utf8')).toBe(EXPECTED);
});

test('"Copy as Markdown" from the canvas menu', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	const card = page.locator('[data-type="doccard"]');
	const b = (await card.boundingBox())!;
	await page.mouse.click(b.x + b.width / 2, b.y + b.height - 30, { button: 'right' });
	await page.getByRole('menuitem', { name: 'Copy as Markdown' }).click();
	await expect(page.getByText('Copied as Markdown')).toBeVisible();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(EXPECTED);
});
