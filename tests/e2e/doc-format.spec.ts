import { expect, test, type Page } from '@playwright/test';
import { createBoard, enableTestHooks, waitForHooks } from './helpers';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
});

const ribbon = (page: Page) => page.locator('[role=toolbar][aria-label="Tools"] [data-doc-ribbon]');

/** Places a doc card with the N tool at the canvas center; its editor is focused. */
async function placeCard(page: Page) {
	await createBoard(page);
	await waitForHooks(page);
	const box = (await page.getByTestId('canvas').boundingBox())!;
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('n');
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	const editor = page.locator('[data-doccard-body] .ProseMirror');
	await expect(editor).toBeFocused();
	return editor;
}

/** Picks an entry of a ribbon menu or color picker; the text gets the focus back. */
async function pick(page: Page, control: string, entry: string, scope = page.locator('body')) {
	await scope.locator(`[data-doc-format="${control}"]`).click();
	if (control === 'textColor' || control === 'highlight') {
		// The open color picker (doc popups are only in the page while open).
		const picker = page.locator('[data-doc-popup].doc-format');
		const none = picker.getByRole('button', { name: entry, exact: true });
		if (await none.count()) await none.click();
		else await picker.getByRole('radio', { name: entry, exact: true }).click();
		await expect(picker).toHaveCount(0);
		return;
	}
	const menu = page.getByRole('menu');
	await menu.getByRole('menuitem', { name: entry, exact: true }).click();
	await expect(menu).toHaveCount(0);
}

test('the ribbon formats the card being edited, and only while it is edited', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	const editor = await placeCard(page);
	await expect(ribbon(page)).toBeVisible();
	await page.keyboard.type('Plan');
	await page.keyboard.press('ControlOrMeta+a');

	const tools = page.getByRole('toolbar', { name: 'Tools' });
	await tools.getByRole('button', { name: 'Bold', exact: true }).click();
	await tools.getByRole('button', { name: 'Underline' }).click();
	await expect(tools.getByRole('button', { name: 'Bold', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await pick(page, 'textColor', 'Red');
	await pick(page, 'highlight', 'Yellow');
	await pick(page, 'fontFamily', 'Lora');
	await pick(page, 'fontSize', 'Large');
	await tools.getByRole('button', { name: 'Align center' }).click();
	await pick(page, 'style', 'Heading 2');

	// Every control left the card in editing, with the keyboard in its text.
	await expect(editor).toBeFocused();
	const text = editor.locator('h2[data-align="center"]');
	await expect(text).toHaveText('Plan');
	await expect(text.locator('strong u')).toHaveText('Plan');
	const span = text.locator('[data-size="large"]');
	await expect(span).toHaveText('Plan');
	await expect(span).toHaveCSS('color', 'rgb(224, 49, 49)');
	await expect(span).toHaveCSS('font-family', /Spacy Lora/);
	await expect(text.locator('[data-highlight="custom"]')).toHaveText('Plan');
	await expect(page.locator('[data-doc-format="style"]')).toHaveText('Heading 2');
	await expect(page.locator('[data-doc-format="fontFamily"]')).toHaveText('Lora');

	await page.keyboard.press('Escape');
	await expect(editor).not.toBeFocused();
	await expect(ribbon(page)).toHaveCount(0);

	await page.reload();
	const reloaded = page.locator(
		'[data-doccard-body] h2[data-align="center"] [data-color="custom"]'
	);
	await expect(reloaded).toHaveText('Plan');
	expect(errors).toEqual([]);
});

test('a choice made at the caret applies to what is typed next', async ({ page }) => {
	const editor = await placeCard(page);
	await page.keyboard.type('plain ');
	await pick(page, 'textColor', 'Blue');
	await page.keyboard.type('blue');
	await pick(page, 'textColor', 'Default color');
	await page.keyboard.type(' plain');
	await expect(editor).toHaveText('plain blue plain');
	await expect(editor.locator('[data-color="custom"]')).toHaveText('blue');

	// Clear formatting removes it again.
	await page.keyboard.press('ControlOrMeta+a');
	await page.getByRole('button', { name: 'Clear formatting' }).click();
	await expect(editor.locator('[data-color]')).toHaveCount(0);
	await expect(editor).toBeFocused();
});

test('focus mode has the same formatting toolbar', async ({ page }) => {
	await placeCard(page);
	await page.keyboard.type('Notes');
	await page.keyboard.press('ControlOrMeta+Enter');
	const dialog = page.locator('[data-focus-mode]');
	const editor = dialog.locator('.ProseMirror');
	await expect(editor).toBeFocused();
	// The shortcut opened focus mode without adding a line break to the text.
	await expect(editor.locator('br:not(.ProseMirror-trailingBreak)')).toHaveCount(0);
	await expect(dialog.getByRole('toolbar', { name: 'Formatting' })).toBeVisible();
	// The canvas card isn't edited while focus mode is open: the ribbon has no doc groups.
	await expect(ribbon(page)).toHaveCount(0);

	await page.keyboard.press('ControlOrMeta+a');
	await dialog.getByRole('button', { name: 'Align right' }).click();
	await pick(page, 'highlight', 'Green', dialog);
	await expect(editor).toBeFocused();
	await page.keyboard.press('End');
	// The editor picks up the collapsed selection a moment after End; a key typed before that
	// (only a script is that fast) would replace the selected text.
	await page.waitForFunction(
		() =>
			(
				document.querySelector('[data-focus-mode] .ProseMirror') as
					(Element & { editor?: { state: { selection: { empty: boolean } } } }) | null
			)?.editor?.state.selection.empty === true
	);
	await page.keyboard.type('!');
	await expect(editor.locator('p[data-align="right"]')).toHaveText('Notes!');
	await expect(editor.locator('[data-highlight="custom"]').first()).toBeVisible();

	// Escape in an open menu closes the menu, not focus mode.
	await dialog.locator('[data-doc-format="style"]').click();
	await expect(page.getByRole('menu')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('menu')).toHaveCount(0);
	await expect(dialog).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(dialog).toHaveCount(0);
	const card = page.locator('[data-doccard-body] p[data-align="right"]');
	await expect(card).toHaveText('Notes!');
	await expect(card.locator('[data-highlight="custom"]').first()).toBeVisible();
});
