import { expect, test, type Page } from '@playwright/test';
import { createBoard, el, enableTestHooks, waitForHooks } from './helpers';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
});

const cardEditor = (page: Page) => page.locator('[data-doccard-body] .ProseMirror');
const focusEditor = (page: Page) => page.locator('[data-focus-body] .ProseMirror');

/** Places a doc card with the N tool and leaves it selected (not editing). */
async function placeCard(page: Page, dx = 0) {
	const box = (await page.getByTestId('canvas').boundingBox())!;
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('n');
	await page.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2);
	await expect(cardEditor(page)).toBeFocused();
}

test('focus mode follows the URL: open, back closes, forward reopens', async ({ page }) => {
	await placeCard(page);
	await page.keyboard.press('Escape');
	await page.keyboard.press('ControlOrMeta+Enter');
	await expect(page).toHaveURL(/\?doc=/);
	const dialog = page.getByRole('dialog', { name: /Doc card/ });
	await expect(dialog).toBeVisible();
	await expect(focusEditor(page)).toBeFocused();
	await page.keyboard.type('Written in focus mode');

	await page.goBack();
	await expect(dialog).toBeHidden();
	await expect(page).not.toHaveURL(/\?doc=/);
	await expect(page.locator('[data-doccard-body]')).toHaveText('Written in focus mode');

	await page.goForward();
	await expect(dialog).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(page).not.toHaveURL(/\?doc=/);
});

test('deep links open focus mode; unknown ids are stripped with a toast', async ({ page }) => {
	await placeCard(page);
	await page.keyboard.type('Deep');
	await page.keyboard.press('Escape');
	const id = await page.evaluate(() => window.__smthng!.ctx.selection.single);
	const base = page.url().split('?')[0]!;
	await page.goto(`${base}?doc=${id}`);
	await expect(page.getByRole('dialog', { name: /Doc card/ })).toBeVisible();
	await expect(focusEditor(page)).toHaveText('Deep');
	// Not pushed by us: closing replaces the entry instead of going back.
	await page.getByRole('button', { name: 'Close focus mode' }).click();
	await expect(page).toHaveURL(base);

	await page.goto(`${base}?doc=nope`);
	await expect(page.getByText('Doc card not found')).toBeVisible();
	await expect(page).toHaveURL(base);
});

test('slash commands insert blocks; the bubble menu formats a selection', async ({ page }) => {
	await placeCard(page);
	await page.keyboard.type('/head');
	const list = page.getByRole('listbox', { name: 'Commands' });
	await expect(list).toBeVisible();
	await expect(list.getByRole('option').first()).toHaveText('Heading 1');
	await page.keyboard.press('Enter');
	await expect(list).toBeHidden();
	await page.keyboard.type('Title');
	await expect(cardEditor(page).locator('h1')).toHaveText('Title');

	await page.keyboard.press('Shift+Home');
	const menu = page.getByRole('toolbar', { name: 'Text formatting' });
	await expect(menu).toBeVisible();
	await menu.getByRole('button', { name: 'Heading 1' }).click(); // toggles back to a paragraph
	await menu.getByRole('button', { name: 'Bold' }).click();
	await expect(cardEditor(page).locator('p strong')).toHaveText('Title');
	// Still editing after using the menu.
	await expect(cardEditor(page)).toBeFocused();
});

test('mentions link to canvas objects and jump to them', async ({ page }) => {
	await page.evaluate((e) => window.__smthng!.createElements([e as never]), {
		...el.shape('st', 1400, 900),
		type: 'sticky',
		kind: undefined,
		text: 'Login flow',
		color: '#ffe066',
		w: 160,
		h: 160
	});
	await placeCard(page);
	await page.keyboard.type('See @Log');
	const list = page.getByRole('listbox', { name: 'Objects' });
	await expect(list.getByRole('option')).toHaveText(['Login flow']);
	await page.keyboard.press('Enter');
	const chip = cardEditor(page).locator('.mention[data-id="st"]');
	await expect(chip).toHaveText('@Login flow');

	await chip.click();
	await expect
		.poll(() => page.evaluate(() => [...window.__smthng!.ctx.selection.ids]))
		.toEqual(['st']);
	// The viewport animates so that the sticky is centered.
	await expect
		.poll(async () => {
			const b = (await page.locator('[data-element-id="st"]').boundingBox())!;
			const c = (await page.getByTestId('canvas').boundingBox())!;
			return Math.hypot(
				b.x + b.width / 2 - (c.x + c.width / 2),
				b.y + b.height / 2 - (c.y + c.height / 2)
			);
		})
		.toBeLessThan(4);
	await expect(page.locator('[data-pulse="st"]')).toBeAttached();

	// Deleted objects: the chip is struck through and says so when clicked.
	await page.keyboard.press('Delete');
	await page.evaluate(() => window.__smthng!.ctx.selection.clear());
	const id = await page.evaluate(
		() => [...window.__smthng!.ctx.store.elements.values()].find((e) => e.type === 'doccard')!.id
	);
	await page.evaluate((id) => window.__smthng!.ctx.selection.set([id]), id);
	await page.keyboard.press('ControlOrMeta+Enter');
	const focusChip = focusEditor(page).locator('.mention[data-id="st"]');
	await expect(focusChip).toHaveClass(/mention-missing/);
	await focusChip.click();
	await expect(page.getByText('This object was deleted')).toBeVisible();
});

test('popups stay inside the window near its bottom edge', async ({ page }) => {
	const box = (await page.getByTestId('canvas').boundingBox())!;
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('n');
	await page.mouse.click(box.x + box.width / 2, box.y + box.height - 40);
	await expect(cardEditor(page)).toBeFocused();
	await page.keyboard.type('/');
	const list = page.getByRole('listbox', { name: 'Commands' });
	await expect(list).toBeVisible();
	const vp = page.viewportSize()!;
	await expect
		.poll(async () => {
			const r = (await list.boundingBox())!;
			return r.y >= 0 && r.x >= 0 && r.y + r.height <= vp.height && r.x + r.width <= vp.width;
		})
		.toBe(true);
});
