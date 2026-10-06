import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { clickElement, createBoard, el, enableTestHooks, waitForHooks } from './helpers';

/** Serious and critical axe violations on the current page, as short strings. */
async function violations(page: Page): Promise<string[]> {
	const results = await new AxeBuilder({ page })
		// Element internals are user content drawn on the canvas (any authored color on any
		// background, text that hit-tests in code): the canvas itself is the accessible object.
		.exclude('[data-testid="world"]')
		.analyze();
	return results.violations
		.filter((v) => v.impact === 'serious' || v.impact === 'critical')
		.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

test('the empty start page', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('[data-template] img')).toHaveCount(4);
	expect(await violations(page)).toEqual([]);
});

test('the start page with boards, and the settings menu', async ({ page }) => {
	await createBoard(page);
	await createBoard(page);
	await page.goto('/');
	await expect(page.locator('article[data-board-id]')).toHaveCount(2);
	expect(await violations(page)).toEqual([]);
	await page.getByRole('button', { name: 'Settings' }).click();
	await expect(page.getByTestId('storage-info')).toBeVisible();
	expect(await violations(page)).toEqual([]);
});

test('a board with a selection and the style popover open', async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await page.evaluate(
		(els) => window.__spacy!.createElements(els as never),
		[el.shape('a', -200, -60, { text: 'Hello' }), el.shape('b', 60, -60)]
	);
	await clickElement(page, 'a');
	expect(await violations(page)).toEqual([]);
	await page.getByTestId('style-fill').click();
	expect(await violations(page)).toEqual([]);
});

test('focus mode', async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	const box = (await page.getByTestId('canvas').boundingBox())!;
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('n');
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await expect(page.locator('[data-doccard-body] .ProseMirror')).toBeFocused();
	await page.keyboard.type('Some text');
	await page.keyboard.press('ControlOrMeta+Enter');
	await expect(page.getByRole('dialog', { name: /Doc card/ })).toBeVisible();
	await expect(page.locator('[data-focus-body] .ProseMirror')).toBeFocused();
	expect(await violations(page)).toEqual([]);
});

test('the export dialog and the shortcuts dialog', async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await page.evaluate((e) => window.__spacy!.createElements([e as never]), el.shape('a', -80, -50));
	await page.getByRole('button', { name: 'Export' }).click();
	await page.getByRole('menuitem', { name: 'PNG…' }).click();
	await expect(page.getByRole('img', { name: 'Export preview' })).toBeVisible();
	expect(await violations(page)).toEqual([]);
	await page.keyboard.press('Escape');

	await page.getByTestId('canvas').focus();
	await page.keyboard.press('?');
	await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
	expect(await violations(page)).toEqual([]);
});

test('dark mode: the start page and a board', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('spacy:theme', '"dark"'));
	await createBoard(page);
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	expect(await violations(page)).toEqual([]);
	await page.goto('/');
	await expect(page.locator('article[data-board-id]')).toHaveCount(1);
	expect(await violations(page)).toEqual([]);
});
