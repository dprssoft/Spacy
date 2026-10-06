import { expect, test } from '@playwright/test';
import { createBoard, el, enableTestHooks, waitForHooks, waitForInitialView } from './helpers';

test('a template creates a connected board with a thumbnail', async ({ page }) => {
	await page.goto('/');
	const card = page.getByRole('button', { name: 'Flowchart template' });
	await expect(card.locator('img')).toBeVisible(); // the live preview
	await card.click();
	await page.waitForURL(/\/board\//);
	await expect(page.locator('[data-type="shape"]')).toHaveCount(5);
	await expect(page.locator('[data-type="connector"]')).toHaveCount(5);
	await expect(page.locator('[data-connector-label]')).toHaveText(['Yes', 'No']);

	await page.goto('/');
	const board = page.locator('article', { has: page.getByText('Flowchart', { exact: true }) });
	await expect(board.locator('img')).toBeVisible();
});

test('meeting notes opens with its document', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Meeting notes template' }).click();
	await page.waitForURL(/\/board\//);
	await expect(page.locator('[data-doccard-body] h2').last()).toHaveText('Action items');
	await expect(page.locator('[data-doccard-body] input[type=checkbox]')).toHaveCount(3);
});

test('a template is inserted into the open board from the gallery, as one undo step', async ({
	page
}) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await waitForInitialView(page);
	await page.evaluate(
		(e) => window.__spacy!.createElements([e as never]),
		el.shape('mine', 2000, 2000)
	);

	await page.getByRole('button', { name: 'Templates (Shift+T)' }).click();
	const dialog = page.getByRole('dialog', { name: 'Insert template' });
	await expect(dialog).toBeVisible();
	await dialog.getByRole('searchbox', { name: 'Search templates' }).fill('brain');
	await expect(dialog.locator('[data-template-card]')).toHaveCount(1);
	await dialog.getByRole('button', { name: 'Brainstorm template' }).click();
	await expect(dialog).toBeHidden();

	const count = () => page.evaluate(() => window.__spacy!.list().length);
	await expect.poll(count).toBeGreaterThan(8);
	const selected = await page.evaluate(() => window.__spacy!.ctx.selection.ids.size);
	expect(selected).toBe((await count()) - 1);
	await expect(page.locator('[data-type=shape]').filter({ hasText: 'Topic' })).toBeVisible();

	await page.getByTestId('canvas').focus();
	await page.keyboard.press('Escape');
	await page.keyboard.press('ControlOrMeta+z');
	await expect.poll(count).toBe(1);

	// Shift+T opens the gallery; Escape closes it.
	await page.keyboard.press('Shift+T');
	await expect(dialog).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
});

test('kanban: cards move between columns and "Stack contents" tidies a column', async ({
	page
}) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await waitForInitialView(page);
	await page.keyboard.press('Shift+T');
	await page.getByRole('button', { name: 'Kanban template' }).click();
	await expect(page.locator('[data-type=frame]')).toHaveCount(3);

	type El = {
		id: string;
		type: string;
		title?: string;
		text?: string;
		parentId: string | null;
		x: number;
		y: number;
	};
	const list = () => page.evaluate(() => window.__spacy!.list() as unknown as El[]);
	const els = await list();
	const done = els.find((e) => e.title === 'Done')!;
	const task = els.find((e) => e.text === 'Task 3')!;

	// Drag "Task 3" into the Done column, below its card.
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('Escape');
	const from = (await page.locator(`[data-element-id="${task.id}"]`).boundingBox())!;
	const target = (await page.locator(`[data-element-id="${done.id}"]`).boundingBox())!;
	await page.mouse.move(from.x + 20, from.y + 20);
	await page.mouse.down();
	await page.mouse.move(target.x + 40, target.y + target.height - 120, { steps: 10 });
	await page.mouse.up();
	await expect
		.poll(async () => (await list()).find((e) => e.id === task.id)!.parentId)
		.toBe(done.id);

	// Stack the Done column: the moved card goes right under the existing one.
	await page.keyboard.press('Escape');
	await page.mouse.click(target.x + 4, target.y - 10); // the frame title selects the frame
	await page.mouse.click(target.x + 4, target.y - 10, { button: 'right' });
	await page.getByRole('menuitem', { name: 'Stack contents' }).click();
	await expect
		.poll(async () => {
			const now = await list();
			const cards = now.filter((e) => e.parentId === done.id).sort((a, b) => a.y - b.y);
			return cards.map((c) => [c.x - done.x, c.text]);
		})
		.toEqual([
			[16, 'Task'],
			[16, 'Task 3']
		]);
});

test('"More templates" on the start page creates a board from any template', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'More templates' }).click();
	const dialog = page.getByRole('dialog', { name: 'New board from a template' });
	await dialog.getByRole('button', { name: 'Strategy' }).click();
	await dialog.getByRole('button', { name: 'SWOT analysis template' }).click();
	await page.waitForURL(/\/board\//);
	await expect(page.locator('[data-type=frame]')).toHaveCount(4);
	await expect(page.getByRole('button', { name: /Rename board: SWOT analysis/ })).toBeVisible();
});

test("the Writing category inserts the Hero's Journey", async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await waitForInitialView(page);
	await page.keyboard.press('Shift+T');
	const dialog = page.getByRole('dialog', { name: 'Insert template' });
	await dialog.getByRole('button', { name: 'Writing' }).click();
	await expect(dialog.locator('[data-template-card]')).toHaveCount(8);
	await dialog.getByRole('button', { name: "Hero's Journey template" }).click();
	await expect
		.poll(() =>
			page.evaluate(() => window.__spacy!.list().filter((e) => e.type === 'sticky').length)
		)
		.toBe(12);
	expect(
		await page.evaluate(() => window.__spacy!.list().filter((e) => e.type === 'connector').length)
	).toBe(12);
});
