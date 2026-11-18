import { expect, test, type Page } from '@playwright/test';
import { createBoard, enableTestHooks, waitForHooks, waitForInitialView } from './helpers';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await waitForInitialView(page);
});

const widget = (page: Page, kind: string) => page.locator(`[data-widget="${kind}"]`);
const settings = (page: Page) => page.getByTestId('widget-settings');

/** Places a widget from the Widgets menu with a click at (dx, dy) from the canvas's top left. */
async function place(page: Page, name: string, kind: string, dx: number, dy: number) {
	await page.getByRole('button', { name: 'Widgets' }).click();
	await page.getByTestId('widgets-menu').getByRole('menuitem', { name }).click();
	const c = (await page.getByTestId('canvas').boundingBox())!;
	await page.mouse.click(c.x + dx, c.y + dy);
	await expect(widget(page, kind)).toHaveCount(1);
}

/** A doc card in the middle of the canvas with four unchecked tasks; returns its id. */
async function cardWithTasks(page: Page): Promise<string> {
	const c = (await page.getByTestId('canvas').boundingBox())!;
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('n');
	await page.mouse.click(c.x + c.width / 2 + 150, c.y + c.height / 2);
	await expect(page.locator('[data-doccard-body] .ProseMirror')).toBeFocused();
	await page.keyboard.type('[ ] one');
	for (const t of ['two', 'three', 'four']) {
		await page.keyboard.press('Enter');
		await page.keyboard.type(t);
	}
	await expect(page.locator('[data-doccard-body] input[type=checkbox]')).toHaveCount(4);
	await page.keyboard.press('Escape');
	await page.keyboard.press('Escape');
	return page.evaluate(() => window.__spacy!.list().find((e) => e.type === 'doccard')!.id);
}

test('progress linked to a doc card counts its checked tasks', async ({ page }) => {
	const cardId = await cardWithTasks(page);
	await place(page, 'Progress', 'progress', 200, 160);
	await expect(widget(page, 'progress')).toContainText('0%');

	// Dropped on the card (dragged by its title), it counts the card's checklist.
	const w = (await widget(page, 'progress').boundingBox())!;
	const card = (await page.locator(`[data-element-id="${cardId}"]`).boundingBox())!;
	await page.mouse.move(w.x + w.width / 2, w.y + 12);
	await page.mouse.down();
	await page.mouse.move(card.x + card.width / 2, card.y + card.height - 70, { steps: 8 });
	await page.mouse.up();
	await expect(widget(page, 'progress')).toContainText('0 of 4 tasks done');
	await expect(page.getByTestId('widget-link-hint')).toHaveCount(1);

	// Check two tasks in the card (selected by its left edge: the widget covers its middle and the
	// header has the collapse button).
	await page.mouse.click(card.x + 10, card.y + card.height / 2);
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('Enter');
	const boxes = page.locator('[data-doccard-body] input[type=checkbox]');
	await boxes.nth(0).check();
	await boxes.nth(2).check();
	await page.keyboard.press('Escape');
	await expect(widget(page, 'progress')).toContainText('50%');
	await expect(widget(page, 'progress')).toContainText('2 of 4 tasks done');
});

test('progress set by dragging its bar; one undo step', async ({ page }) => {
	await place(page, 'Progress', 'progress', 300, 200);
	const b = (await widget(page, 'progress').boundingBox())!;
	// The bar runs from x 16 to 244 of the 260-wide design, at y 52–66 of 110.
	const x = (f: number) => b.x + ((16 + 228 * f) / 260) * b.width;
	const y = b.y + (59 / 110) * b.height;
	await page.mouse.move(x(0.1), y);
	await page.mouse.down();
	await page.mouse.move(x(0.4), y, { steps: 4 });
	await page.mouse.move(x(0.6), y, { steps: 4 });
	await page.mouse.up();
	await expect(widget(page, 'progress')).toContainText('60%');
	// It stayed where it was.
	expect((await widget(page, 'progress').boundingBox())!.x).toBeCloseTo(b.x, 0);
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('ControlOrMeta+z');
	await expect(widget(page, 'progress')).toContainText('0%');
});

test('a status click cycles it and Ctrl+Z goes back', async ({ page }) => {
	await place(page, 'Status', 'status', 300, 200);
	await expect(widget(page, 'status')).toHaveText('On track');
	const b = (await widget(page, 'status').boundingBox())!;
	await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
	await expect(widget(page, 'status')).toHaveText('At risk');
	await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
	await expect(widget(page, 'status')).toHaveText('Blocked');
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('ControlOrMeta+z');
	await expect(widget(page, 'status')).toHaveText('At risk');
});

test('a deadline in the past shows overdue', async ({ page }) => {
	await place(page, 'Deadline', 'deadline', 300, 200);
	await expect(widget(page, 'deadline')).toContainText('In 7 days');
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('Shift+Enter');
	await expect(settings(page)).toBeVisible();
	await settings(page).getByTestId('deadline-label').fill('Launch');
	await settings(page).getByTestId('deadline-label').press('Tab');
	await settings(page).getByTestId('deadline-date').fill('2020-01-01');
	await page.keyboard.press('Escape');
	await expect(widget(page, 'deadline')).toContainText(/\d+ days overdue/);
	await expect(widget(page, 'deadline')).toContainText('Launch');
	await expect(widget(page, 'deadline')).toContainText('Wed 1 Jan 2020');
});
