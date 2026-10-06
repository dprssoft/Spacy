import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { clickElement, createBoard, el, enableTestHooks, waitForHooks } from './helpers';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
});

type Snap = { id: string; color?: string; style: { fill: string; font: { family?: string } } };
const byId = async (page: Page, id: string) =>
	((await page.evaluate(() => window.__spacy!.list())) as Snap[]).find((e) => e.id === id)!;
const add = (page: Page, els: unknown[]) =>
	page.evaluate((els) => window.__spacy!.createElements(els as never), els);

test('canvas text takes a bundled font, which loads and survives a reload', async ({ page }) => {
	await add(page, [el.shape('a', -80, -50, { text: 'Привіт, world' })]);
	await clickElement(page, 'a');
	await page.getByTestId('style-text').click();
	const fonts = page.getByRole('radiogroup', { name: 'Font' });
	await expect(fonts.getByRole('radio', { name: 'Default' })).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await fonts.getByRole('radio', { name: 'Caveat' }).click();
	expect((await byId(page, 'a')).style.font.family).toBe('caveat');

	const label = page.locator('[data-element-id="a"]').getByText('Привіт, world');
	await expect(label).toHaveCSS('font-family', /"Spacy Caveat"/);
	// The Cyrillic subset too.
	await expect
		.poll(() => page.evaluate(() => document.fonts.check('18px "Spacy Caveat"', 'Привіт')))
		.toBe(true);

	await page.reload();
	await expect(page.locator('[data-element-id="a"]').getByText('Привіт, world')).toHaveCSS(
		'font-family',
		/"Spacy Caveat"/
	);
});

test('any color: typed hex, remembered under Recent, also for sticky notes', async ({ page }) => {
	await add(page, [
		el.shape('a', -300, -50),
		{
			...el.shape('s', 100, -100),
			type: 'sticky',
			kind: undefined,
			color: '#ffe066',
			w: 200,
			h: 200
		}
	]);
	await clickElement(page, 'a');
	await page.getByTestId('style-fill').click();
	await page.getByRole('textbox', { name: 'Hex color' }).fill('12AB9F');
	await page.keyboard.press('Enter');
	expect((await byId(page, 'a')).style.fill).toBe('#12ab9f');
	await expect(page.locator('[data-element-id="a"] path')).toHaveAttribute('fill', '#12ab9f');

	// A shade from the bigger palette.
	await page
		.getByRole('radiogroup', { name: 'Fill color' })
		.getByRole('radio', { name: 'Light indigo' })
		.click();
	expect((await byId(page, 'a')).style.fill).toBe('#748ffc');

	// The custom color is offered again, in every picker.
	await page.keyboard.press('Escape');
	await clickElement(page, 's');
	await page.getByTestId('style-sticky').click();
	const recent = page.getByRole('radiogroup', { name: 'Recent colors' });
	await recent.getByRole('radio', { name: '#12ab9f' }).click();
	expect((await byId(page, 's')).color).toBe('#12ab9f');
});

test('doc cards: a bundled font and any color from the ribbon', async ({ page }) => {
	const box = (await page.getByTestId('canvas').boundingBox())!;
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('n');
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	const editor = page.locator('[data-doccard-body] .ProseMirror');
	await expect(editor).toBeFocused();
	await page.keyboard.type('Styled');
	await page.keyboard.press('ControlOrMeta+a');

	await page.locator('[data-doc-format="fontFamily"]').click();
	await page.getByRole('menuitem', { name: 'Playfair Display', exact: true }).click();
	await page.locator('[data-doc-format="textColor"]').click();
	const picker = page.locator('[data-doc-popup].doc-format');
	await picker.getByRole('textbox', { name: 'Hex color' }).fill('#7a1fa2');
	await page.keyboard.press('Enter');
	await expect(picker).toHaveCount(0);
	await expect(editor).toBeFocused();

	const span = editor.locator('[data-font="playfair"]');
	await expect(span).toHaveText('Styled');
	await expect(span).toHaveCSS('font-family', /"Spacy Playfair Display"/);
	await expect(editor.locator('[data-color="custom"]')).toHaveCSS('color', 'rgb(122, 31, 162)');
});

test('the sketch ribbon has more colors', async ({ page }) => {
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('b');
	await page.getByTestId('sketch-more-colors').click();
	await page.getByRole('radio', { name: 'Dark teal' }).click();
	expect(await page.evaluate(() => window.__spacy!.ctx.sketch.color)).toBe('#0b7285');
});

test('SVG export embeds the fonts it uses', async ({ page }) => {
	await add(page, [
		el.shape('a', -80, -50, {
			text: 'Fancy',
			style: {
				...el.shape('x', 0, 0).style,
				font: { ...el.shape('x', 0, 0).style.font, family: 'pacifico' }
			}
		})
	]);
	await page.getByRole('button', { name: 'Export' }).click();
	await page.getByRole('menuitem', { name: 'SVG…' }).click();
	const dialog = page.getByRole('dialog', { name: 'Export image' });
	await expect(dialog.getByRole('img', { name: 'Export preview' })).toBeVisible();
	const [file] = await Promise.all([
		page.waitForEvent('download'),
		dialog.getByRole('button', { name: 'Download' }).click()
	]);
	const svg = await readFile((await file.path())!, 'utf8');
	expect(svg).toMatch(/@font-face\{font-family:"Spacy Pacifico";src:url\(data:font\/woff2;base64,/);
	expect(svg).toContain('font-family="&#34;Spacy Pacifico&#34;, cursive"');
	// Only the fonts in use.
	expect(svg).not.toContain('Spacy Caveat');
});
