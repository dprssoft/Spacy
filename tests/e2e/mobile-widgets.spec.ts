import { expect, test } from '@playwright/test';
import { createBoard, enableTestHooks, waitForHooks, waitForInitialView } from './helpers';
import { Touch } from './touch';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await waitForInitialView(page);
});

test('Insert more → Widgets → Timer, tap to place, tap its button to start', async ({ page }) => {
	await page.getByRole('button', { name: 'Insert more' }).click();
	await page.getByRole('menuitem', { name: 'Widgets' }).click();
	await page.getByRole('menuitem', { name: 'Timer' }).click();
	const c = (await page.getByTestId('canvas').boundingBox())!;
	const touch = new Touch(page);
	await touch.tap({ x: c.x + c.width / 2, y: c.y + c.height / 2 });
	const widget = page.locator('[data-type="widget"]');
	await expect(widget).toHaveCount(1);
	const b = (await widget.boundingBox())!;
	await page.evaluate(() => window.__spacy!.ctx.selection.clear());
	await touch.tap({ x: b.x + (146 / 240) * b.width, y: b.y + (210 / 240) * b.height });
	await expect
		.poll(() =>
			page.evaluate(() => {
				const w = window.__spacy!.list().find((e) => e.type === 'widget');
				return w?.type === 'widget' ? (w.state as { startedAt: number | null }).startedAt : null;
			})
		)
		.not.toBeNull();
});
