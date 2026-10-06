import { expect, test, type Page } from '@playwright/test';
import { clickElement, createBoard, el, enableTestHooks, waitForHooks } from './helpers';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
});

type Snap = {
	id: string;
	kind?: string;
	text?: string;
	color?: string;
	style: { fill: string; opacity: number; font: { size: string; bold: boolean } };
};
const byId = async (page: Page, id: string) =>
	((await page.evaluate(() => window.__spacy!.list())) as Snap[]).find((e) => e.id === id)!;
const add = (page: Page, els: unknown[]) =>
	page.evaluate((els) => window.__spacy!.createElements(els as never), els);
const sticky = (id: string, x: number, y: number) => ({
	...el.shape(id, x, y),
	type: 'sticky',
	kind: undefined,
	color: '#ffe066',
	text: 'Note',
	w: 200,
	h: 200
});
const popover = (page: Page) => page.getByTestId('style-popover');

test('changing the fill persists across reloads', async ({ page }) => {
	await add(page, [el.shape('a', -80, -50, { text: 'Hi' })]);
	await clickElement(page, 'a');
	await page.getByTestId('style-fill').click();
	await page
		.getByRole('radiogroup', { name: 'Fill color' })
		.getByRole('radio', { name: 'Red', exact: true })
		.click();
	await expect(page.locator('[data-element-id="a"] path')).toHaveAttribute('fill', '#e03131');
	await page.reload();
	await expect(page.locator('[data-element-id="a"] path')).toHaveAttribute('fill', '#e03131');
});

test('only options shared by the selected types are shown', async ({ page }) => {
	await add(page, [el.shape('a', -300, -50), sticky('s', 100, -100)]);
	await clickElement(page, 'a');
	await expect(page.getByTestId('style-fill')).toBeVisible();
	await expect(page.getByTestId('style-shape')).toBeVisible();
	await clickElement(page, 's', ['Shift']);
	await expect(popover(page)).toBeVisible();
	await expect(page.getByTestId('style-fill')).toBeHidden();
	await expect(page.getByTestId('style-shape')).toBeHidden();
	await expect(page.getByTestId('style-text')).toBeVisible();

	// A shared change applies to both.
	await page.getByTestId('style-text').click();
	await page.getByRole('radio', { name: 'Large', exact: true }).click();
	expect((await byId(page, 'a')).style.font.size).toBe('l');
	expect((await byId(page, 's')).style.font.size).toBe('l');
});

test('mixed values show no selected swatch', async ({ page }) => {
	await add(page, [
		el.shape('a', -300, -50),
		el.shape('b', 100, -50, { style: { ...el.shape('x', 0, 0).style, fill: '#a5d8ff' } })
	]);
	await clickElement(page, 'a');
	await clickElement(page, 'b', ['Shift']);
	await page.getByTestId('style-fill').click();
	const swatches = page.getByRole('radiogroup', { name: 'Fill color' });
	await expect(swatches.getByRole('radio', { checked: true })).toHaveCount(0);
	await swatches.getByRole('radio', { name: 'Green', exact: true }).click();
	await expect(swatches.getByRole('radio', { checked: true })).toHaveCount(1);
});

test('changing the shape kind keeps the text; sticky color changes', async ({ page }) => {
	await add(page, [el.shape('a', -300, -50, { text: 'Keep me' }), sticky('s', 100, -100)]);
	await clickElement(page, 'a');
	await page.getByTestId('style-shape').click();
	await page.getByRole('radio', { name: 'Diamond' }).click();
	expect(await byId(page, 'a')).toMatchObject({ kind: 'diamond', text: 'Keep me' });

	await clickElement(page, 's');
	await page.getByTestId('style-sticky').click();
	await page.getByRole('radio', { name: 'Blue', exact: true }).click();
	expect((await byId(page, 's')).color).toBe('#a5d8ff');
});

test('an opacity drag is one undo step; bold toggles', async ({ page }) => {
	await add(page, [el.shape('a', -80, -50, { text: 'Hi' })]);
	await clickElement(page, 'a');
	await page.getByTestId('style-more').click();
	const slider = page.getByRole('slider', { name: 'Opacity' });
	await slider.focus();
	for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
	expect((await byId(page, 'a')).style.opacity).toBeCloseTo(0.6, 5);
	await page.keyboard.press('Escape');
	await page.evaluate(() => window.__spacy!.ctx.history.undo());
	expect((await byId(page, 'a')).style.opacity).toBe(1);

	await page.getByTestId('style-text').click();
	await page.getByRole('button', { name: 'Bold' }).click();
	expect((await byId(page, 'a')).style.font.bold).toBe(true);
	await expect(page.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
});

test('segmented controls work with the keyboard', async ({ page }) => {
	await add(page, [el.shape('a', -80, -50, { text: 'Hi' })]);
	await clickElement(page, 'a');
	await page.getByTestId('style-text').click();
	await page.getByRole('radio', { name: 'Medium', exact: true }).focus();
	await page.keyboard.press('ArrowRight');
	expect((await byId(page, 'a')).style.font.size).toBe('l');
	await expect(page.getByRole('radio', { name: 'Large', exact: true })).toBeFocused();
});

test('the popover does not cover the selection, near the top it goes below', async ({ page }) => {
	await add(page, [el.shape('a', -80, -50)]);
	await clickElement(page, 'a');
	const intersects = async () => {
		const p = (await popover(page).boundingBox())!;
		const s = (await page.locator('[data-element-id="a"]').boundingBox())!;
		return !(
			p.x + p.width < s.x ||
			s.x + s.width < p.x ||
			p.y + p.height < s.y ||
			s.y + s.height < p.y
		);
	};
	expect(await intersects()).toBe(false);
	const above =
		(await popover(page).boundingBox())!.y <
		(await page.locator('[data-element-id="a"]').boundingBox())!.y;
	expect(above).toBe(true);

	// Pan so the shape touches the top of the canvas: the popover flips below it.
	const c = (await page.getByTestId('canvas').boundingBox())!;
	const s = (await page.locator('[data-element-id="a"]').boundingBox())!;
	await page.mouse.move(c.x + 500, c.y + 300);
	await page.mouse.wheel(0, s.y - c.y - 10);
	await expect.poll(intersects).toBe(false);
	const p = (await popover(page).boundingBox())!;
	const s2 = (await page.locator('[data-element-id="a"]').boundingBox())!;
	expect(p.y).toBeGreaterThan(s2.y + s2.height);
});

test('the popover hides while dragging and while editing text', async ({ page }) => {
	await add(page, [el.shape('a', -80, -50)]);
	await clickElement(page, 'a');
	await expect(popover(page)).toBeVisible();
	const b = (await page.locator('[data-element-id="a"]').boundingBox())!;
	await page.mouse.move(b.x + 20, b.y + 20);
	await page.mouse.down();
	await page.mouse.move(b.x + 80, b.y + 40, { steps: 4 });
	await expect(popover(page)).toBeHidden();
	await page.mouse.up();
	await expect(popover(page)).toBeVisible();
	await page.keyboard.press('Enter');
	await expect(popover(page)).toBeHidden();
});
