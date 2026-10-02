import { expect, test, type Page } from '@playwright/test';
import { createBoard, el, enableTestHooks, waitForHooks } from './helpers';

type Shape = { id: string; type: string; kind?: string; text?: string; x: number; y: number };
const list = (page: Page) => page.evaluate(() => window.__smthng!.list()) as Promise<Shape[]>;
const selected = (page: Page) => page.evaluate(() => [...window.__smthng!.ctx.selection.ids]);
const announced = (page: Page) => page.getByTestId('announcer');

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
});

test('create, edit, move and get help without the mouse', async ({ page }) => {
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('r');
	await expect(announced(page)).toHaveText('Rectangle tool');
	await page.keyboard.press('Enter');
	await expect.poll(async () => (await list(page)).length).toBe(1);
	const [rect] = await list(page);
	expect(rect).toMatchObject({ type: 'shape', kind: 'rect' });
	expect(await selected(page)).toEqual([rect!.id]);
	await expect(announced(page)).toHaveText('Rectangle created');

	await page.keyboard.press('Enter'); // edit its text
	await expect(page.getByRole('textbox', { name: 'Edit text' })).toBeFocused();
	await page.keyboard.type('Keyboard');
	await page.keyboard.press('Escape');
	await expect.poll(async () => (await list(page))[0]!.text).toBe('Keyboard');

	for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
	await expect.poll(async () => (await list(page))[0]!.x).toBe(rect!.x + 10);

	await page.keyboard.press('?');
	const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText('Duplicate');
	await dialog.getByRole('searchbox', { name: 'Search shortcuts' }).fill('zoom to fit');
	await expect(dialog.locator('dt')).toHaveText(['Zoom to fit']);
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
});

test('every creation tool creates at the center with Enter', async ({ page }) => {
	await page.getByTestId('canvas').focus();
	for (const key of ['s', 'n', 'f']) {
		await page.keyboard.press(key);
		await page.keyboard.press('Enter');
		await page.keyboard.press('Escape'); // deselect
	}
	await expect
		.poll(async () => (await list(page)).map((e) => e.type).sort())
		.toEqual(['doccard', 'frame', 'sticky']);
	// Text goes straight to typing.
	await page.keyboard.press('t');
	await page.keyboard.press('Enter');
	await page.keyboard.type('Typed');
	await page.keyboard.press('Escape');
	await expect
		.poll(async () => (await list(page)).find((e) => e.type === 'text')?.text)
		.toBe('Typed');
});

test('Tab walks through objects in reading order, then leaves the canvas', async ({ page }) => {
	await page.evaluate(
		(els) => window.__smthng!.createElements(els as never),
		[el.shape('c', -200, 120), el.shape('b', 100, -150), el.shape('a', -200, -150)]
	);
	const canvas = page.getByTestId('canvas');
	await canvas.focus();
	for (const id of ['a', 'b', 'c']) {
		await page.keyboard.press('Tab');
		expect(await selected(page)).toEqual([id]);
		await expect(canvas).toBeFocused();
	}
	await expect(announced(page)).toHaveText('Rectangle selected');
	await page.keyboard.press('Shift+Tab');
	expect(await selected(page)).toEqual(['b']);
	await page.keyboard.press('Tab');
	await page.keyboard.press('Tab'); // past the last object: focus moves on
	await expect(canvas).not.toBeFocused();
	expect(await selected(page)).toEqual([]);
});

test('the toolbar is one tab stop with arrow-key navigation', async ({ page }) => {
	const toolbar = page.getByRole('toolbar', { name: 'Tools' });
	await expect(toolbar.locator('button[tabindex="0"]')).toHaveCount(1);
	await toolbar.getByRole('button', { name: 'Select (V)' }).focus();
	await page.keyboard.press('ArrowDown');
	await expect(toolbar.getByRole('button', { name: 'Hand (H)' })).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(toolbar.getByRole('button', { name: 'Hand (H)' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.keyboard.press('End');
	await expect(toolbar.getByRole('button', { name: 'Keep tool active' })).toBeFocused();
	await page.keyboard.press('Home');
	await expect(toolbar.getByRole('button', { name: 'Select (V)' })).toBeFocused();
	await expect(toolbar.locator('button[tabindex="0"]')).toHaveCount(1);
});
