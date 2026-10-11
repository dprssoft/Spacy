import { expect, test, type Page } from '@playwright/test';
import { createBoard, enableTestHooks, waitForHooks, waitForInitialView } from './helpers';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await waitForInitialView(page);
});

const widget = (page: Page) => page.locator('[data-type="widget"]');
/** The big time on the face. */
const headline = (page: Page) => widget(page).locator('text').first();
const timerState = (page: Page) =>
	page.evaluate(() => {
		const w = window.__spacy!.list().find((e) => e.type === 'widget');
		return w?.type === 'widget' ? (w.state as { startedAt: number | null; elapsed: number }) : null;
	});

/** A point in the timer's 240 × 240 design space, on screen. */
async function at(page: Page, x: number, y: number) {
	const b = (await widget(page).boundingBox())!;
	return { x: b.x + (x / 240) * b.width, y: b.y + (y / 240) * b.height };
}
const START = [146, 210] as const; // the start/pause button
const FACE = [120, 60] as const; // no button

async function placeTimer(page: Page) {
	await page.getByRole('button', { name: 'Widgets' }).click();
	await page.getByTestId('widgets-menu').getByRole('menuitem', { name: 'Timer' }).click();
	const c = (await page.getByTestId('canvas').boundingBox())!;
	await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2);
	await expect(widget(page)).toHaveCount(1);
}

test('place a timer from the Widgets menu, run it, set it up; running is not undone', async ({
	page
}) => {
	await placeTimer(page);
	await expect(headline(page)).toHaveText('5:00');
	expect(await page.evaluate(() => [...window.__spacy!.ctx.selection.ids].length)).toBe(1);

	// Its settings: Shift+Enter with it selected; a preset; a title.
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('Shift+Enter');
	const settings = page.getByTestId('widget-settings');
	await expect(settings).toBeVisible();
	await settings.getByRole('button', { name: '1 min' }).click();
	await expect(headline(page)).toHaveText('1:00');
	await settings.getByRole('textbox', { name: 'Title' }).fill('Break');
	await page.keyboard.press('Escape');
	await expect(settings).toHaveCount(0);

	// A click on its button starts it, without selecting it.
	await page.evaluate(() => window.__spacy!.ctx.selection.clear());
	const start = await at(page, ...START);
	await page.mouse.click(start.x, start.y);
	await expect.poll(async () => (await timerState(page))?.startedAt).not.toBeNull();
	expect(await page.evaluate(() => window.__spacy!.ctx.selection.ids.size)).toBe(0);
	await expect(headline(page)).toHaveText('0:58', { timeout: 3000 });

	// Undo takes back the last edit (the title), not the start.
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('ControlOrMeta+z');
	await expect(widget(page).locator('text').nth(1)).toHaveText('Timer');
	expect((await timerState(page))?.startedAt).not.toBeNull();

	// Still running at the right time after a reload.
	await page.reload();
	await waitForHooks(page);
	await expect(headline(page)).toHaveText(/^0:5\d$/);
	const before = await headline(page).textContent();
	await expect(headline(page)).not.toHaveText(before!, { timeout: 3000 });

	// Select it (on its face) and pause with Enter.
	const face = await at(page, ...FACE);
	await page.mouse.click(face.x, face.y);
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('Enter');
	await expect.poll(async () => (await timerState(page))?.startedAt).toBeNull();
});

test('drag a timer from the Widgets menu onto the canvas', async ({ page }) => {
	await page.getByRole('button', { name: 'Widgets' }).click();
	const item = page.getByTestId('widgets-menu').getByRole('menuitem', { name: 'Timer' });
	const c = (await page.getByTestId('canvas').boundingBox())!;
	// Native HTML drag and drop, as the shapes menu does it.
	const data = await page.evaluateHandle(() => new DataTransfer());
	await item.dispatchEvent('dragstart', { dataTransfer: data });
	await page
		.getByTestId('canvas')
		.dispatchEvent('drop', { dataTransfer: data, clientX: c.x + 200, clientY: c.y + 200 });
	await expect(widget(page)).toHaveCount(1);
	const kinds = await page.evaluate(() =>
		window.__spacy!.list().map((e) => (e.type === 'widget' ? e.kind : e.type))
	);
	expect(kinds).toEqual(['timer']);
});
