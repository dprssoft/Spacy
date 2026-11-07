import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { createBoard, enableTestHooks, waitForHooks } from './helpers';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	const box = (await page.getByTestId('canvas').boundingBox())!;
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('n');
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await expect(page.locator('[data-doccard-body] .ProseMirror')).toBeFocused();
});

test('a table from the slash menu takes formatted text, rows and a reload', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	const editor = page.locator('[data-doccard-body] .ProseMirror');

	await page.keyboard.type('/table');
	await page.getByRole('option', { name: 'Table' }).click();
	const table = editor.locator('table');
	await expect(table.locator('tr')).toHaveCount(3);
	await expect(table.locator('th')).toHaveCount(3);

	await page.keyboard.type('Name');
	await page.keyboard.press('Tab');
	await page.keyboard.type('Role');
	await page.keyboard.press('Tab');
	await page.keyboard.press('Tab');
	await page.keyboard.press('ControlOrMeta+b');
	await page.keyboard.type('Ann');
	await expect(table.locator('td strong')).toHaveText('Ann');

	// The ribbon's table menu, with the caret in the table.
	const tools = page.getByRole('toolbar', { name: 'Tools' });
	await tools.getByRole('button', { name: 'Table', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Insert row below' }).click();
	await expect(table.locator('tr')).toHaveCount(4);
	await expect(editor).toBeFocused();

	// No table inside a table: the slash menu opens in an empty cell, without Table.
	await page.keyboard.press('Tab');
	await page.keyboard.type('/');
	await expect(page.getByRole('option', { name: 'Heading 1' })).toBeVisible();
	await expect(page.getByRole('option', { name: 'Table' })).toHaveCount(0);
	await page.keyboard.press('Escape');
	await page.keyboard.press('Backspace');

	await page.keyboard.press('Escape');
	await page.waitForTimeout(400);
	await page.reload();
	const saved = page.locator('[data-doccard-body] table');
	await expect(saved.locator('tr')).toHaveCount(4);
	await expect(saved.locator('th').first()).toHaveText('Name');
	await expect(saved.locator('td strong')).toHaveText('Ann');

	await page.getByRole('button', { name: 'Doc card options' }).click();
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('menuitem', { name: 'Download .md' }).click()
	]);
	const md = await readFile((await download.path())!, 'utf8');
	expect(md).toContain('| Name | Role |  |\n| --- | --- | --- |\n| **Ann** |  |  |');
	expect(errors).toEqual([]);
});

test('the ribbon inserts a table and deletes it', async ({ page }) => {
	const tools = page.getByRole('toolbar', { name: 'Tools' });
	const editor = page.locator('[data-doccard-body] .ProseMirror');
	await tools.getByRole('button', { name: 'Insert table' }).click();
	await expect(editor.locator('table tr')).toHaveCount(3);
	await expect(editor).toBeFocused();
	await tools.getByRole('button', { name: 'Table', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Delete table' }).click();
	await expect(editor.locator('table')).toHaveCount(0);
});
