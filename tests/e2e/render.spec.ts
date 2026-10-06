import { expect, test } from '@playwright/test';
import { createBoard, el, enableTestHooks, waitForHooks, waitForInitialView } from './helpers';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
});

test('elements created through the model render and persist', async ({ page }) => {
	await createBoard(page);
	await waitForHooks(page);
	await page.evaluate(
		(els) => window.__spacy!.createElements(els as never),
		[
			el.shape('rect', -200, -100, { text: 'Hello' }),
			{
				...el.shape('sticky', 50, -100),
				type: 'sticky',
				kind: undefined,
				color: '#ffe066',
				text: 'Note',
				w: 200,
				h: 200
			},
			{
				...el.shape('label', -200, 150),
				type: 'text',
				kind: undefined,
				text: 'Title',
				autoWidth: true
			}
		]
	);
	await expect(page.locator('[data-element-id]')).toHaveCount(3);
	await expect(page.locator('[data-element-id="rect"]')).toContainText('Hello');
	await expect(page.locator('[data-element-id="sticky"]')).toContainText('Note');
	await expect(page.locator('[data-element-id="label"]')).toContainText('Title');

	await page.reload();
	await expect(page.locator('[data-element-id]')).toHaveCount(3);
});

test('culling keeps off-screen elements out of the DOM, and Shift+1 fits content', async ({
	page
}) => {
	await createBoard(page);
	await waitForHooks(page);
	// Otherwise the board may open fitted to the 3,000 elements, with all of them on screen.
	await waitForInitialView(page);
	const total = await page.evaluate(() => window.__spacy!.perf(3000));
	expect(total).toBe(3000);
	await expect(page.locator('[data-element-id]').first()).toBeVisible();
	const rendered = await page.locator('[data-element-id]').count();
	expect(rendered).toBeGreaterThan(0);
	expect(rendered).toBeLessThan(600);

	await page.getByTestId('canvas').focus();
	await page.keyboard.press('Shift+1');
	// The perf board spans ~10,000 px, so fitting it zooms far out.
	await expect(page.getByTestId('zoom-level')).toHaveText(/^1\d%$/);
});

test('edits from another tab render live', async ({ page, context }) => {
	const id = await createBoard(page);
	await waitForHooks(page);
	const other = await context.newPage();
	await other.goto(`/board/${id}`);
	await other.waitForFunction(() => !!window.__spacy);
	await other.evaluate(
		(e) => window.__spacy!.createElements([e as never]),
		el.shape('remote', 0, 0)
	);
	await expect(page.locator('[data-element-id="remote"]')).toBeVisible();
});
