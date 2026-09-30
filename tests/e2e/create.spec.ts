import { expect, test, type Page } from '@playwright/test';
import { clickElement, createBoard, enableTestHooks, waitForHooks } from './helpers';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
});

const canvasBox = async (page: Page) => (await page.getByTestId('canvas').boundingBox())!;
const list = (page: Page) => page.evaluate(() => window.__smthng!.list());
const undoDepth = (page: Page) => page.evaluate(() => window.__smthng!.ctx.undo.undoStack.length);

async function press(page: Page, key: string) {
	await page.getByTestId('canvas').focus();
	await page.keyboard.press(key);
}

test('R + drag draws a rectangle of the dragged size as one undo step', async ({ page }) => {
	const box = await canvasBox(page);
	await press(page, 'r');
	await page.mouse.move(box.x + 300, box.y + 200);
	await page.mouse.down();
	await page.mouse.move(box.x + 400, box.y + 260, { steps: 5 });
	await page.waitForTimeout(700); // pause longer than the undo capture window
	await page.mouse.move(box.x + 500, box.y + 320, { steps: 5 });
	await page.mouse.up();

	const [rect] = await list(page);
	expect(rect).toMatchObject({ type: 'shape', kind: 'rect' });
	expect(rect!.w).toBeCloseTo(200, 0);
	expect(rect!.h).toBeCloseTo(120, 0);
	expect(await undoDepth(page)).toBe(1);
	// Back to select, with the new shape selected.
	await expect(page.getByRole('button', { name: 'Select' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	expect(await page.evaluate(() => [...window.__smthng!.ctx.selection.ids])).toEqual([rect!.id]);

	await page.evaluate(() => window.__smthng!.ctx.undo.undo());
	expect(await list(page)).toEqual([]);
});

test('O + click creates a default-size ellipse; Shift keeps a circle', async ({ page }) => {
	const box = await canvasBox(page);
	await press(page, 'o');
	await page.mouse.click(box.x + 300, box.y + 300);
	await press(page, 'o');
	await page.keyboard.down('Shift');
	await page.mouse.move(box.x + 600, box.y + 200);
	await page.mouse.down();
	await page.mouse.move(box.x + 700, box.y + 240, { steps: 4 });
	await page.mouse.up();
	await page.keyboard.up('Shift');
	const [a, b] = await list(page);
	expect(a).toMatchObject({ kind: 'ellipse', w: 160, h: 100 });
	expect(b).toMatchObject({ kind: 'ellipse' });
	expect(b!.w).toBeCloseTo(b!.h, 5);
});

test('S + click creates a sticky and starts typing; text survives reload', async ({ page }) => {
	const box = await canvasBox(page);
	await press(page, 's');
	await page.mouse.click(box.x + 400, box.y + 300);
	const editor = page.getByRole('textbox', { name: 'Edit text' });
	await expect(editor).toBeFocused();
	await page.keyboard.type('Hello');
	await page.keyboard.press('Escape');
	await expect(editor).toBeHidden();
	const [sticky] = await list(page);
	expect(sticky).toMatchObject({ type: 'sticky', text: 'Hello' });

	await page.reload();
	await expect(page.locator(`[data-element-id="${sticky!.id}"]`)).toContainText('Hello');
});

test('T + click + type creates an auto-sized text; left empty it disappears', async ({ page }) => {
	const box = await canvasBox(page);
	await press(page, 't');
	await page.mouse.click(box.x + 300, box.y + 300);
	await page.keyboard.type('Title');
	await page.mouse.click(box.x + 700, box.y + 500); // click away commits
	const [text] = await list(page);
	expect(text).toMatchObject({ type: 'text', text: 'Title', autoWidth: true });
	expect(text!.w).toBeGreaterThan(30);

	const depth = await undoDepth(page);
	await press(page, 't');
	await page.mouse.click(box.x + 300, box.y + 450);
	await expect(page.getByRole('textbox', { name: 'Edit text' })).toBeFocused();
	await page.keyboard.press('Escape');
	expect(await list(page)).toHaveLength(1);
	expect(await undoDepth(page)).toBe(depth); // no phantom undo step
});

test('double-click a shape to edit its text; Enter edits the selection', async ({ page }) => {
	const box = await canvasBox(page);
	await press(page, 'r');
	await page.mouse.click(box.x + 400, box.y + 300);
	const [rect] = await list(page);

	const el = await page.locator(`[data-element-id="${rect!.id}"]`).boundingBox();
	await page.mouse.dblclick(el!.x + el!.width / 2, el!.y + el!.height / 2);
	await page.keyboard.type('Box');
	await page.keyboard.press('Escape');
	await expect(page.locator(`[data-element-id="${rect!.id}"]`)).toContainText('Box');

	// Still selected after Escape: Enter re-enters editing with the caret at the end.
	await page.keyboard.press('Enter');
	await page.keyboard.type('!');
	await page.keyboard.press('Control+Enter');
	await expect(page.locator(`[data-element-id="${rect!.id}"]`)).toContainText('Box!');
});

test('double-click empty canvas writes a text there', async ({ page }) => {
	const box = await canvasBox(page);
	await page.mouse.dblclick(box.x + 500, box.y + 400);
	await page.keyboard.type('Note to self');
	await page.keyboard.press('Escape');
	const [text] = await list(page);
	expect(text).toMatchObject({ type: 'text', text: 'Note to self' });
	await clickElement(page, text!.id);
	expect(await page.evaluate(() => [...window.__smthng!.ctx.selection.ids])).toEqual([text!.id]);
});

test('typing in the editor does not trigger tool shortcuts', async ({ page }) => {
	const box = await canvasBox(page);
	await press(page, 's');
	await page.mouse.click(box.x + 400, box.y + 300);
	await page.keyboard.type('hard rest');
	await expect(page.getByRole('button', { name: 'Select' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.keyboard.press('Escape');
	expect((await list(page))[0]).toMatchObject({ text: 'hard rest' });
});
