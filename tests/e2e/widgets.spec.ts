import { expect, test, type Page } from '@playwright/test';
import { createBoard, el, enableTestHooks, waitForHooks, waitForInitialView } from './helpers';

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

const sticky = (id: string, x: number, y: number, text: string) => ({
	...el.shape(id, x, y),
	type: 'sticky',
	kind: undefined,
	text,
	color: '#ffe066',
	w: 160,
	h: 160
});
const widgetState = (page: Page, id: string) =>
	page.evaluate((id) => {
		const w = window.__spacy!.list().find((e) => e.id === id);
		return w?.type === 'widget' ? w.state : null;
	}, id);

test('make a wheel from selected notes and spin it', async ({ page }) => {
	await page.evaluate(
		(els) => window.__spacy!.createElements(els as never),
		[sticky('a', -400, -200, 'Ann'), sticky('b', -400, 0, 'Bea'), sticky('c', -200, -200, 'Cy')]
	);
	await page.evaluate(() => window.__spacy!.ctx.selection.set(['a', 'b', 'c']));
	const box = (await page.locator('[data-element-id="a"]').boundingBox())!;
	await page.mouse.click(box.x + 40, box.y + 40, { button: 'right' });
	await page.getByRole('menuitem', { name: 'Make a wheel from selection' }).click();
	const wheel = page.locator('[data-widget="wheel"]');
	await expect(wheel).toHaveCount(1);
	const id = await page.evaluate(() => [...window.__spacy!.ctx.selection.ids][0]!);
	await expect(wheel.locator('text', { hasText: 'Ann' })).toHaveCount(1);

	// Spin with Enter (it's selected); the banner shows one of the three after it stops.
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('Enter');
	await expect(wheel.getByText('Spinning…')).toHaveCount(1);
	const winner = wheel.locator('text[font-weight="700"]');
	await expect(winner).toHaveText(/^(Ann|Bea|Cy)$/, { timeout: 8000 });
	const state = (await widgetState(page, id)) as { spin: { winner: number } };
	const labels = await page.evaluate((id) => {
		const w = window.__spacy!.list().find((e) => e.id === id);
		const c = w?.type === 'widget' ? (w.config as { segments: { label: string }[] }) : null;
		return c?.segments.map((s) => s.label) ?? [];
	}, id);
	// Top to bottom, then left to right.
	expect(labels).toEqual(['Ann', 'Cy', 'Bea']);
	expect(labels[state.spin.winner]).toBe(await winner.textContent());
	await expect(page.getByTestId('announcer')).toHaveText(`Wheel: ${await winner.textContent()}`);
});

test('randomizer makes teams and places them as notes; one undo removes them', async ({ page }) => {
	const randomizer = {
		...el.shape('r', -130, -150),
		type: 'widget',
		kind: 'randomizer',
		text: undefined,
		title: '',
		w: 260,
		h: 300,
		config: { items: ['a', 'b', 'c', 'd', 'e'], mode: 'teams', count: 2 },
		state: { draw: null }
	};
	await page.evaluate((e) => window.__spacy!.createElements([e as never]), randomizer);
	await expect(page.locator('[data-widget="randomizer"]')).toHaveCount(1);
	const r = page.locator('[data-widget="randomizer"]');
	const b = (await r.boundingBox())!;
	const at = (x: number, y: number) => ({
		x: b.x + (x / 260) * b.width,
		y: b.y + (y / 300) * b.height
	});
	const draw = at(86, 270);
	await page.mouse.click(draw.x, draw.y);
	await expect(r.getByText('Team 2')).toHaveCount(1, { timeout: 3000 });
	const place = at(204, 270);
	await page.mouse.click(place.x, place.y);
	const notes = () =>
		page.evaluate(() => window.__spacy!.list().filter((e) => e.type === 'sticky').length);
	await expect.poll(notes).toBe(5);
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('ControlOrMeta+z');
	await expect.poll(notes).toBe(0);
	expect(((await widgetState(page, 'r')) as { draw: unknown }).draw).not.toBeNull();
});
