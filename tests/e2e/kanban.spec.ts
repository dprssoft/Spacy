import { expect, test, type Page } from '@playwright/test';
import { clickElement, createBoard, el, enableTestHooks, waitForHooks } from './helpers';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
});

type Snap = { id: string; type: string; parentId: string | null; y: number; text?: string };
const list = async (page: Page) => (await page.evaluate(() => window.__spacy!.list())) as Snap[];
const add = (page: Page, els: unknown[]) =>
	page.evaluate((els) => window.__spacy!.createElements(els as never), els);
/** Card texts of a column, top to bottom. */
const texts = async (page: Page, column: string) =>
	(await list(page))
		.filter((e) => e.parentId === column)
		.sort((a, b) => a.y - b.y)
		.map((e) => e.text);

const column = (id: string, x: number, title: string) => ({
	...el.shape(id, x, -300, { w: 320, h: 600 }),
	type: 'frame',
	kind: undefined,
	text: undefined,
	title,
	kanban: 'board'
});
const card = (id: string, parentId: string, x: number, text: string) => ({
	...el.shape(id, x + 20, -280, { w: 280, h: 100, parentId }),
	type: 'sticky',
	kind: undefined,
	text,
	color: '#ffe066'
});

test('kanban cards: change status, add tasks with Enter, duplicate as an empty card', async ({
	page
}) => {
	await add(page, [
		column('todo', -400, 'To do'),
		column('done', 0, 'Done'),
		card('t1', 'todo', -400, 'Plan')
	]);

	// Status: pick another column and the card moves there.
	await page.locator('[data-element-id="t1"] [data-testid="kanban-status"]').click();
	await page.getByRole('menuitem', { name: 'Done' }).click();
	await expect.poll(() => texts(page, 'done')).toEqual(['Plan']);
	await expect(page.locator('[data-element-id="t1"] [data-testid="kanban-status"]')).toContainText(
		'Done'
	);
	await page.keyboard.press('ControlOrMeta+Z');
	await expect.poll(() => texts(page, 'todo')).toEqual(['Plan']);

	// Add task, then Enter makes the next card; an empty one left with Escape goes away.
	await page.locator('[data-element-id="todo"] [data-testid="kanban-add-task"]').click();
	await page.keyboard.type('Write tests');
	await page.keyboard.press('Enter');
	await page.keyboard.type('Ship');
	await page.keyboard.press('Enter');
	await page.keyboard.press('Escape');
	await expect.poll(() => texts(page, 'todo')).toEqual(['Plan', 'Write tests', 'Ship']);

	// Duplicate: an empty card right under the original, ready to type on.
	await clickElement(page, 't1');
	await page.keyboard.press('ControlOrMeta+D');
	await page.keyboard.type('Review');
	await page.keyboard.press('Escape');
	await expect.poll(() => texts(page, 'todo')).toEqual(['Plan', 'Review', 'Write tests', 'Ship']);
});

test('a card whose status changes to an emptied column turns that column’s color', async ({
	page
}) => {
	await add(page, [
		column('todo', -400, 'To do'),
		column('done', 0, 'Done'),
		card('t1', 'todo', -400, 'Plan'),
		{ ...card('d1', 'done', 0, 'Ship'), color: '#b2f2bb' }
	]);
	const setStatus = async (id: string, to: string) => {
		await page.locator(`[data-element-id="${id}"] [data-testid="kanban-status"]`).click();
		await page.getByRole('menuitem', { name: to }).click();
	};
	await setStatus('d1', 'To do');
	await expect.poll(() => texts(page, 'done')).toEqual([]);
	await setStatus('t1', 'Done');
	await expect.poll(() => texts(page, 'done')).toEqual(['Plan']);
	const color = async () =>
		((await list(page)).find((e) => e.id === 't1') as Snap & { color?: string }).color;
	await expect.poll(color).toBe('#b2f2bb');
});
