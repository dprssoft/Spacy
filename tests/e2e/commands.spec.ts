import { expect, test, type Page } from '@playwright/test';
import {
	clickElement,
	clipboardPermissions,
	createBoard,
	el,
	enableTestHooks,
	waitForHooks
} from './helpers';

test.use({ permissions: async ({ browserName }, use) => use(clipboardPermissions(browserName)) });

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
});

type Snap = {
	id: string;
	type: string;
	x: number;
	z: string;
	groupId: string | null;
	locked: boolean;
};
const list = (page: Page) => page.evaluate(() => window.__spacy!.list()) as Promise<Snap[]>;
const add = (page: Page, els: unknown[]) =>
	page.evaluate((els) => window.__spacy!.createElements(els as never), els);
const selected = (page: Page) => page.evaluate(() => [...window.__spacy!.ctx.selection.ids].sort());

test('copy/paste, duplicate, delete and undo/redo with the keyboard', async ({ page }) => {
	await add(page, [el.shape('a', -80, -50)]);
	await clickElement(page, 'a');
	await page.keyboard.press('ControlOrMeta+c');
	await page.keyboard.press('ControlOrMeta+v');
	await expect.poll(async () => (await list(page)).length).toBe(2);
	await page.keyboard.press('ControlOrMeta+d');
	await expect.poll(async () => (await list(page)).length).toBe(3);
	await page.keyboard.press('Delete');
	await expect.poll(async () => (await list(page)).length).toBe(2);

	const undo = page.getByRole('button', { name: 'Undo' });
	const redo = page.getByRole('button', { name: 'Redo' });
	await expect(redo).toBeDisabled();
	await page.keyboard.press('ControlOrMeta+z');
	await expect.poll(async () => (await list(page)).length).toBe(3);
	await expect(redo).toBeEnabled();
	await redo.click();
	await expect.poll(async () => (await list(page)).length).toBe(2);
	await undo.click();
	await expect.poll(async () => (await list(page)).length).toBe(3);
});

test('cut removes the selection and paste brings it back', async ({ page }) => {
	await add(page, [el.shape('a', -80, -50)]);
	await clickElement(page, 'a');
	await page.keyboard.press('ControlOrMeta+x');
	await expect.poll(async () => (await list(page)).length).toBe(0);
	await page.keyboard.press('ControlOrMeta+v');
	await expect.poll(async () => (await list(page)).length).toBe(1);
});

test('copy on one board, paste on another', async ({ page }) => {
	await add(page, [el.shape('a', -80, -50, { text: 'Travelling' })]);
	await clickElement(page, 'a');
	await page.keyboard.press('ControlOrMeta+c');

	await createBoard(page);
	await waitForHooks(page);
	expect(await list(page)).toEqual([]);
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('ControlOrMeta+v');
	await expect.poll(async () => (await list(page)).length).toBe(1);
	await expect(page.locator('[data-element-id]')).toContainText('Travelling');
});

test('plain text from the clipboard becomes a text element', async ({ page }) => {
	await page.evaluate(() => navigator.clipboard.writeText('Pasted note'));
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('ControlOrMeta+v');
	await expect.poll(async () => (await list(page))[0]?.type).toBe('text');
	await expect(page.locator('[data-element-id]')).toContainText('Pasted note');
});

test('group selects together; lock prevents moving', async ({ page }) => {
	await add(page, [el.shape('a', -300, -50), el.shape('b', 0, -50)]);
	await clickElement(page, 'a');
	await clickElement(page, 'b', ['Shift']);
	await page.keyboard.press('ControlOrMeta+g');
	await page.getByTestId('canvas').focus();
	await page.mouse.click(5, 300); // deselect on empty canvas
	await clickElement(page, 'a');
	expect(await selected(page)).toEqual(['a', 'b']);

	await page.keyboard.press('ControlOrMeta+Shift+l');
	expect((await list(page)).every((e) => e.locked)).toBe(true);
	const box = (await page.locator('[data-element-id="a"]').boundingBox())!;
	await page.mouse.move(box.x + 20, box.y + 20);
	await page.mouse.down();
	await page.mouse.move(box.x + 120, box.y + 20, { steps: 5 });
	await page.mouse.up();
	expect((await list(page)).find((e) => e.id === 'a')!.x).toBe(-300);
});

test('the context menu reorders layers and paste works from it', async ({ page }) => {
	await add(page, [el.shape('a', -80, -50), el.shape('b', -40, -20)]);
	const order = () =>
		page
			.locator('[data-element-id]')
			.evaluateAll((n) => n.map((x) => x.getAttribute('data-element-id')));
	await expect.poll(order).toEqual(['a', 'b']); // rendering happens on the next frame

	const box = (await page.locator('[data-element-id="a"]').boundingBox())!;
	await page.mouse.click(box.x + 10, box.y + 10, { button: 'right' });
	expect(await selected(page)).toEqual(['a']);
	await page.getByRole('menuitem', { name: /Bring to front/ }).click();
	await expect.poll(order).toEqual(['b', 'a']);

	await page.mouse.click(box.x + 10, box.y + 10, { button: 'right' });
	await page.getByRole('menuitem', { name: /^Copy/ }).click();
	// Empty canvas, clear of the toolbar (x < 60) and the zoom controls (bottom right).
	await page.mouse.click(300, 620, { button: 'right' });
	expect(await selected(page)).toEqual([]);
	await page.getByRole('menuitem', { name: /^Paste/ }).click();
	await expect.poll(async () => (await list(page)).length).toBe(3);
});

test('shortcuts reorder with ] and [', async ({ page }) => {
	await add(page, [el.shape('a', -80, -50), el.shape('b', -40, -20)]);
	// Click a's top-left corner: b covers a's center.
	const box = (await page.locator('[data-element-id="a"]').boundingBox())!;
	await page.mouse.click(box.x + 10, box.y + 10);
	expect(await selected(page)).toEqual(['a']);
	await page.keyboard.press(']');
	const order = () =>
		page
			.locator('[data-element-id]')
			.evaluateAll((n) => n.map((x) => x.getAttribute('data-element-id')));
	await expect.poll(order).toEqual(['b', 'a']);
	await page.keyboard.press('[');
	await expect.poll(order).toEqual(['a', 'b']);
});
