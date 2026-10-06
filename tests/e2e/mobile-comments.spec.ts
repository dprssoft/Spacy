import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { createBoard, el, enableTestHooks, waitForHooks, waitForInitialView } from './helpers';
import { Touch } from './touch';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await waitForInitialView(page);
});

test('long-press a sticky → Comment → a bottom sheet to write in', async ({ page }) => {
	await page.evaluate((e) => window.__spacy!.createElements([e as never]), {
		...el.shape('s', -80, -80),
		type: 'sticky',
		kind: undefined,
		text: 'Hold',
		color: '#ffe066'
	});
	const b = (await page.getByTestId('canvas').boundingBox())!;
	const c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
	await new Touch(page).drag(c, c, { holdMs: 700, steps: 1 });
	await page.getByRole('menuitem', { name: /Comment/ }).click();

	const sheet = page.getByRole('dialog', { name: 'Comments' });
	await expect(sheet).toBeVisible();
	const box = (await sheet.boundingBox())!;
	const vp = page.viewportSize()!;
	expect(Math.round(box.x)).toBe(0);
	expect(Math.round(box.width)).toBe(vp.width);
	expect(Math.round(box.y + box.height)).toBe(vp.height);

	await sheet.locator('[data-comment-name]').fill('Ann');
	await sheet.getByRole('textbox', { name: 'Add a comment' }).fill('From my phone');
	const post = sheet.getByRole('button', { name: 'Comment', exact: true });
	expect((await post.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
	await post.click();
	await expect(sheet.locator('[data-comment-thread]')).toContainText('From my phone');
	await expect(page.locator('[data-comment-badge="s"]')).toHaveText('1');

	const axe = await new AxeBuilder({ page }).include('[data-comment-popover]').analyze();
	expect(axe.violations).toEqual([]);
});
