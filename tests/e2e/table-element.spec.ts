import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { createBoard, enableTestHooks, waitForHooks } from './helpers';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
});

const tables = (page: Page) => page.locator('[data-type="table"]');

/** Places a table with the G tool at the canvas center; its first cell has the caret. */
async function placeTable(page: Page) {
	const box = (await page.getByTestId('canvas').boundingBox())!;
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('g');
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	const editor = tables(page).locator('[data-table-body] .ProseMirror');
	await expect(editor).toBeFocused();
	return editor;
}

test('type formatted text in cells; the box grows with new rows', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	const editor = await placeTable(page);
	await expect(editor.locator('tr')).toHaveCount(3);
	await expect(editor.locator('th')).toHaveCount(3);

	await page.keyboard.type('Task');
	await page.keyboard.press('Tab');
	await page.keyboard.press('ControlOrMeta+i');
	await page.keyboard.type('Owner');
	await expect(editor.locator('th em')).toHaveText('Owner');

	// Only what a table can hold: no text styles or lists, no "Delete table".
	const tools = page.getByRole('toolbar', { name: 'Tools' });
	await expect(tools.getByRole('button', { name: 'Bold', exact: true })).toBeVisible();
	await expect(tools.locator('[data-doc-format="style"]')).toHaveCount(0);
	await expect(tools.getByRole('button', { name: 'Bullet list' })).toHaveCount(0);

	const before = (await tables(page).boundingBox())!.height;
	await tools.getByRole('button', { name: 'Table', exact: true }).click();
	await expect(page.getByRole('menuitem', { name: 'Delete table' })).toHaveCount(0);
	await page.getByRole('menuitem', { name: 'Insert row below' }).click();
	await expect(editor.locator('tr')).toHaveCount(4);
	await expect.poll(async () => (await tables(page).boundingBox())!.height).toBeGreaterThan(before);

	await page.keyboard.press('Escape');
	await expect(editor).not.toBeFocused();
	await page.waitForTimeout(400);
	await page.reload();
	const saved = tables(page).locator('[data-table-body] table');
	await expect(saved.locator('tr')).toHaveCount(4);
	await expect(saved.locator('th em')).toHaveText('Owner');
	expect(errors).toEqual([]);
});

test('duplicate keeps the cells, undo removes the table, export draws it', async ({ page }) => {
	await placeTable(page);
	await page.keyboard.type('Budget');
	await page.keyboard.press('Escape');
	// Leaving editing keeps the table selected.
	await page.keyboard.press('ControlOrMeta+d');
	await expect(tables(page)).toHaveCount(2);
	await expect(tables(page).nth(1).locator('th').first()).toHaveText('Budget');

	await page.keyboard.press('ControlOrMeta+z');
	await expect(tables(page)).toHaveCount(1);

	await page.getByRole('button', { name: 'Export' }).click();
	await page.getByRole('menuitem', { name: 'SVG…' }).click();
	const dialog = page.getByRole('dialog', { name: 'Export image' });
	await expect(dialog.getByRole('img', { name: 'Export preview' })).toBeVisible();
	const [file] = await Promise.all([
		page.waitForEvent('download'),
		dialog.getByRole('button', { name: 'Download' }).click()
	]);
	const svg = await readFile((await file.path())!, 'utf8');
	expect(svg).toContain('>Budget</tspan>');
});

test('the "+" buttons of a selected table add columns and rows on every side', async ({ page }) => {
	const editor = await placeTable(page);
	await page.keyboard.type('First');
	await page.keyboard.press('Escape');
	await expect(editor).not.toBeFocused();
	const rows = editor.locator('tr');
	await page.getByRole('button', { name: 'Add column right' }).click();
	await expect(rows.first().locator('th')).toHaveCount(4);
	await page.getByRole('button', { name: 'Add column left' }).click();
	await expect(rows.first().locator('th')).toHaveCount(5);
	await expect(rows.first().locator('th').nth(1)).toHaveText('First');
	await page.getByRole('button', { name: 'Add row below' }).click();
	await expect(rows).toHaveCount(4);
	await expect(rows.last().locator('td')).toHaveCount(5);
	await page.getByRole('button', { name: 'Add row above' }).click();
	await expect(rows).toHaveCount(5);
	await expect(rows.nth(1).locator('th').nth(1)).toHaveText('First');
	// No connected copies were made, and each click is one undo step.
	await expect(page.locator('[data-element-id]')).toHaveCount(1);
	await page.keyboard.press('ControlOrMeta+z');
	await expect(rows).toHaveCount(4);
	await expect(rows.first().locator('th').nth(1)).toHaveText('First');
});

test('drag across cells, merge them, then split the merged cell', async ({ page }) => {
	const editor = await placeTable(page);
	const head = editor.locator('tr').first().locator('th');
	const a = (await head.nth(0).boundingBox())!;
	const b = (await head.nth(1).boundingBox())!;
	await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
	await page.mouse.down();
	await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 5 });
	await page.mouse.up();
	await expect(editor.locator('.selectedCell')).toHaveCount(2);

	const tools = page.getByRole('toolbar', { name: 'Tools' });
	await tools.getByRole('button', { name: 'Table', exact: true }).click();
	await expect(page.getByRole('menuitem', { name: 'Split cell' })).toHaveAttribute(
		'data-disabled',
		''
	);
	await page.getByRole('menuitem', { name: 'Merge cells' }).click();
	await expect(head).toHaveCount(2);
	await expect(head.first()).toHaveAttribute('colspan', '2');

	await tools.getByRole('button', { name: 'Table', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Split cell' }).click();
	await expect(head).toHaveCount(3);
});
