import { expect, test, type Page } from '@playwright/test';
import { createBoard, el, enableTestHooks, waitForHooks } from './helpers';

const ids = (page: Page) =>
	page.evaluate(() =>
		window
			.__spacy!.list()
			.map((e) => e.id)
			.sort()
	);
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
const add = (page: Page, id: string) =>
	page.evaluate(
		(e) => window.__spacy!.createElements([e as never]),
		el.shape(id, -80, -50, { text: id })
	);

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
});

test('pages keep separate content; the last page is reopened after a reload', async ({ page }) => {
	await expect(page.getByRole('tab')).toHaveText(['Page 1']);
	await add(page, 'one');
	await page.getByRole('button', { name: 'Add page' }).click();
	await expect(page.getByRole('tab')).toHaveText(['Page 1', 'Page 2']);
	await expect(tab(page, 'Page 2')).toHaveAttribute('aria-selected', 'true');
	await expect(page.locator('[data-element-id]')).toHaveCount(0);
	await expect(page.getByTestId('status-count')).toHaveText('0 objects');

	await add(page, 'two');
	await expect(page.locator('[data-element-id="two"]')).toHaveText('two');
	await tab(page, 'Page 1').click();
	await expect(page.locator('[data-element-id="one"]')).toBeVisible();
	await expect(page.locator('[data-element-id="two"]')).toHaveCount(0);
	expect(await ids(page)).toEqual(['one']);

	await tab(page, 'Page 2').click();
	await expect(page.getByText('Saved locally')).toBeVisible();
	await page.reload();
	await expect(tab(page, 'Page 2')).toHaveAttribute('aria-selected', 'true');
	await expect(page.locator('[data-element-id="two"]')).toBeVisible();
});

test('rename, move and delete a page from its tab', async ({ page }) => {
	await page.getByRole('button', { name: 'Add page' }).click();
	await add(page, 'two');
	await tab(page, 'Page 2').dblclick();
	const input = page.getByRole('textbox', { name: 'Page name' });
	await input.fill('Budget');
	await input.press('Enter');
	await expect(page.getByRole('tab')).toHaveText(['Page 1', 'Budget']);

	await tab(page, 'Budget').click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Move left' }).click();
	await expect(page.getByRole('tab')).toHaveText(['Budget', 'Page 1']);

	await tab(page, 'Budget').click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Delete' }).click();
	await expect(page.getByRole('alertdialog')).toContainText('Delete “Budget”?');
	await page.getByRole('button', { name: 'Delete page' }).click();
	await expect(page.getByRole('tab')).toHaveText(['Page 1']);
	expect(await ids(page)).toEqual([]);

	// The last page can't be deleted.
	await tab(page, 'Page 1').click({ button: 'right' });
	await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveAttribute('data-disabled', '');
});

test('drag a tab or use Ctrl+Shift+Arrow to reorder pages', async ({ page }) => {
	await page.getByRole('button', { name: 'Add page' }).click();
	await page.getByRole('button', { name: 'Add page' }).click();
	await tab(page, 'Page 1').click();
	await expect(page.getByRole('tab')).toHaveText(['Page 1', 'Page 2', 'Page 3']);

	const drag = async (name: string, to: string, side: 'left' | 'right', escape = false) => {
		const from = (await tab(page, name).boundingBox())!;
		const target = (await tab(page, to).boundingBox())!;
		await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
		await page.mouse.down();
		const x = side === 'left' ? target.x + 4 : target.x + target.width - 4;
		await page.mouse.move(x, target.y + target.height / 2, { steps: 8 });
		await expect(page.getByTestId('page-drop-mark')).toBeVisible();
		if (escape) await page.keyboard.press('Escape');
		await page.mouse.up();
	};

	await drag('Page 1', 'Page 3', 'right');
	await expect(page.getByRole('tab')).toHaveText(['Page 2', 'Page 3', 'Page 1']);
	// Dropping doesn't switch pages.
	await expect(tab(page, 'Page 1')).toHaveAttribute('aria-selected', 'true');

	await drag('Page 3', 'Page 2', 'left');
	await expect(page.getByRole('tab')).toHaveText(['Page 3', 'Page 2', 'Page 1']);
	await expect(tab(page, 'Page 1')).toHaveAttribute('aria-selected', 'true');

	await drag('Page 1', 'Page 3', 'left', true);
	await expect(page.getByRole('tab')).toHaveText(['Page 3', 'Page 2', 'Page 1']);
	await expect(page.getByTestId('page-drop-mark')).toHaveCount(0);

	await tab(page, 'Page 1').focus();
	await page.keyboard.press('Control+Shift+ArrowLeft');
	await expect(page.getByRole('tab')).toHaveText(['Page 3', 'Page 1', 'Page 2']);
	await expect(tab(page, 'Page 1')).toBeFocused();

	await page.reload();
	await expect(page.getByRole('tab')).toHaveText(['Page 3', 'Page 1', 'Page 2']);
});

test('reorder pages by dragging a tab or with Ctrl+Shift+Arrow', async ({ page }) => {
	await page.getByRole('button', { name: 'Add page' }).click();
	await page.getByRole('button', { name: 'Add page' }).click();
	await expect(page.getByRole('tab')).toHaveText(['Page 1', 'Page 2', 'Page 3']);

	const drag = async (name: string, to: string, side: 'left' | 'right') => {
		const from = (await tab(page, name).boundingBox())!;
		const target = (await tab(page, to).boundingBox())!;
		await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
		await page.mouse.down();
		const x = side === 'left' ? target.x + 4 : target.x + target.width - 4;
		await page.mouse.move(x, target.y + target.height / 2, { steps: 8 });
		await expect(page.getByTestId('page-drop-mark')).toBeVisible();
		return () => page.mouse.up();
	};

	// Dropping a tab must not switch to it.
	await tab(page, 'Page 1').click();
	await (
		await drag('Page 3', 'Page 1', 'left')
	)();
	await expect(page.getByRole('tab')).toHaveText(['Page 3', 'Page 1', 'Page 2']);
	await expect(tab(page, 'Page 1')).toHaveAttribute('aria-selected', 'true');

	await (
		await drag('Page 3', 'Page 2', 'right')
	)();
	await expect(page.getByRole('tab')).toHaveText(['Page 1', 'Page 2', 'Page 3']);

	// Escape cancels a drag.
	await drag('Page 1', 'Page 3', 'right');
	await page.keyboard.press('Escape');
	await page.mouse.up();
	await expect(page.getByTestId('page-drop-mark')).toHaveCount(0);
	await expect(page.getByRole('tab')).toHaveText(['Page 1', 'Page 2', 'Page 3']);

	await tab(page, 'Page 1').focus();
	await page.keyboard.press('ControlOrMeta+Shift+ArrowRight');
	await expect(page.getByRole('tab')).toHaveText(['Page 2', 'Page 1', 'Page 3']);
	await expect(tab(page, 'Page 1')).toBeFocused();

	await page.reload();
	await expect(page.getByRole('tab')).toHaveText(['Page 2', 'Page 1', 'Page 3']);
});

test('duplicate a page, then delete several pages at once', async ({ page }) => {
	await add(page, 'one');
	await tab(page, 'Page 1').click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Duplicate' }).click();
	await expect(page.getByRole('tab')).toHaveText(['Page 1', 'Page 1 copy']);
	await expect(tab(page, 'Page 1 copy')).toHaveAttribute('aria-selected', 'true');
	await expect(page.locator('[data-type="shape"]')).toHaveText('one');
	expect(await ids(page)).toHaveLength(1);
	expect(await ids(page)).not.toEqual(['one']); // a copy, with its own id

	await page.getByRole('button', { name: 'Add page' }).click();
	await expect(page.getByRole('tab')).toHaveText(['Page 1', 'Page 1 copy', 'Page 3']);
	await tab(page, 'Page 1').click({ modifiers: ['ControlOrMeta'] });
	await expect(tab(page, 'Page 1')).toHaveAttribute('data-picked', 'true');
	await tab(page, 'Page 1').click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Delete 2 pages' }).click();
	await expect(page.getByRole('alertdialog')).toContainText('Delete 2 pages?');
	await page.getByRole('button', { name: 'Delete 2 pages' }).click();
	await expect(page.getByRole('tab')).toHaveText(['Page 1 copy']);
	await expect(page.locator('[data-type="shape"]')).toHaveText('one');

	// Every page picked: deleting them all isn't offered.
	await page.getByRole('button', { name: 'Add page' }).click();
	await tab(page, 'Page 1 copy').click({ modifiers: ['Shift'] });
	await tab(page, 'Page 2').click({ button: 'right' });
	await expect(page.getByRole('menuitem', { name: 'Delete 2 pages' })).toHaveAttribute(
		'data-disabled',
		''
	);
});

test('undo returns to the page where the change was made', async ({ page }) => {
	await add(page, 'one');
	await page.getByRole('button', { name: 'Add page' }).click();
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('s');
	await page.keyboard.press('Enter'); // a sticky at the center of page 2
	await expect(page.locator('[data-type="sticky"]')).toHaveCount(1);
	await page.keyboard.press('Escape');
	await tab(page, 'Page 1').click();

	await page.getByTestId('canvas').focus();
	await page.keyboard.press('ControlOrMeta+z');
	await expect(tab(page, 'Page 2')).toHaveAttribute('aria-selected', 'true');
	await expect(page.locator('[data-type="sticky"]')).toHaveCount(0);
});

test('a second tab sees new pages and their content', async ({ page, context }) => {
	const other = await context.newPage();
	await other.goto(page.url());
	await other.waitForFunction(() => !!window.__spacy);
	await page.getByRole('button', { name: 'Add page' }).click();
	await add(page, 'two');
	await expect(other.getByRole('tab')).toHaveText(['Page 1', 'Page 2']);
	// Each tab keeps its own current page.
	await expect(other.getByRole('tab', { name: 'Page 1' })).toHaveAttribute('aria-selected', 'true');
	await other.getByRole('tab', { name: 'Page 2' }).click();
	await expect(other.locator('[data-element-id="two"]')).toHaveText('two');
});

test('a mention jumps to an object on another page', async ({ page }) => {
	await page.evaluate((e) => window.__spacy!.createElements([e as never]), {
		...el.shape('st', 0, 0),
		type: 'sticky',
		kind: undefined,
		text: 'Login flow',
		color: '#ffe066',
		w: 160,
		h: 160
	});
	await page.getByRole('button', { name: 'Add page' }).click();
	const box = (await page.getByTestId('canvas').boundingBox())!;
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('n');
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	const editor = page.locator('[data-doccard-body] .ProseMirror');
	await expect(editor).toBeFocused();
	// Objects on other pages aren't offered, but an existing chip still finds its target.
	await page.evaluate(() => {
		const ed = (
			document.querySelector('[data-doccard-body] .ProseMirror') as HTMLElement & {
				editor: { commands: { insertContent(c: unknown): void } };
			}
		).editor;
		ed.commands.insertContent({ type: 'mention', attrs: { id: 'st', label: 'Login flow' } });
	});
	await editor.locator('.mention[data-id="st"]').click();
	await expect(tab(page, 'Page 1')).toHaveAttribute('aria-selected', 'true');
	await expect
		.poll(() => page.evaluate(() => [...window.__spacy!.ctx.selection.ids]))
		.toEqual(['st']);
});
