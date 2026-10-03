import { expect, test, type Page } from '@playwright/test';
import { createBoard, el, enableTestHooks, waitForHooks } from './helpers';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
});

type Card = { id: string; type: string; x: number; y: number; h: number; collapsed: boolean };
const list = (page: Page) => page.evaluate(() => window.__smthng!.list()) as Promise<Card[]>;
const cards = async (page: Page) => (await list(page)).filter((e) => e.type === 'doccard');

/** Places a doc card with the N tool at the canvas center and types into it. */
async function placeCard(page: Page) {
	const box = (await page.getByTestId('canvas').boundingBox())!;
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('n');
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	const editor = page.locator('[data-doccard-body] .ProseMirror');
	await expect(editor).toBeFocused();
	return editor;
}

test('type with markdown shortcuts; the content persists and syncs to another tab', async ({
	page,
	context
}) => {
	await createBoard(page);
	await waitForHooks(page);
	const url = page.url();
	await placeCard(page);
	const other = await context.newPage();
	await other.goto(url);
	// The 1 s limit below is for syncing, not for the other tab's loading (its editor is lazy).
	await expect(other.locator('[data-doccard-body] .ProseMirror')).toBeVisible();
	await page.keyboard.type('# Plan');
	await page.keyboard.press('Enter');
	await page.keyboard.type('- item');
	await expect(other.locator('[data-doccard-body] h1')).toHaveText('Plan', { timeout: 1000 });
	await page.keyboard.press('Escape');
	expect((await cards(page)).length).toBe(1);
	await expect(page.locator('[data-doccard-body] .ProseMirror')).not.toBeFocused();

	await page.reload();
	await expect(page.locator('[data-doccard-body] h1')).toHaveText('Plan');
	await expect(page.locator('[data-doccard-body] li')).toHaveText('item');
});

test('selecting text with the mouse never moves the card', async ({ page }) => {
	await createBoard(page);
	await waitForHooks(page);
	await placeCard(page);
	await page.keyboard.type('Some words to select with the mouse');
	const before = (await cards(page))[0]!;
	const p = (await page.locator('[data-doccard-body] p').first().boundingBox())!;
	await page.mouse.move(p.x + 2, p.y + p.height / 2);
	await page.mouse.down();
	await page.mouse.move(p.x + 120, p.y + p.height / 2 + 40, { steps: 6 });
	await page.mouse.up();
	const after = (await cards(page))[0]!;
	expect([after.x, after.y]).toEqual([before.x, before.y]);
	const selected = await page.evaluate(() => window.getSelection()?.toString() ?? '');
	expect(selected.length).toBeGreaterThan(3);
});

test('an existing card can be edited again by double-click and by Enter', async ({ page }) => {
	// Focusing the editor once looped an effect: a hang in dev, an uncaught error in a build.
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await createBoard(page);
	await waitForHooks(page);
	const editor = await placeCard(page);
	await page.keyboard.type('First');
	await page.keyboard.press('Escape');
	await expect(editor).not.toBeFocused();

	// Below the text: the caret goes to the end.
	const body = (await page.locator('[data-doccard-body]').boundingBox())!;
	await page.mouse.dblclick(body.x + body.width / 2, body.y + body.height - 20);
	await expect(editor).toBeFocused();
	await page.keyboard.type(' second');
	await expect(editor).toHaveText('First second');
	await page.keyboard.press('Escape');
	await expect(editor).not.toBeFocused();

	await page.keyboard.press('Enter');
	await expect(editor).toBeFocused();
	await page.keyboard.type(' third');
	await expect(editor).toHaveText('First second third');
	expect(errors).toEqual([]);
});

test('collapse keeps connectors attached to the header', async ({ page }) => {
	await createBoard(page);
	await waitForHooks(page);
	await placeCard(page);
	await page.keyboard.type('body');
	await page.keyboard.press('Escape');
	const card = (await cards(page))[0]!;
	await page.evaluate(
		(e) => window.__smthng!.createElements([e as never]),
		el.shape('s', -520, -50)
	);
	// Connect the shape to the card with the connector tool.
	const center = async (sel: string) => {
		const b = (await page.locator(sel).boundingBox())!;
		return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
	};
	const a = await center('[data-element-id="s"]');
	const b = await center(`[data-element-id="${card.id}"]`);
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('a');
	await page.mouse.move(a.x, a.y);
	await page.mouse.down();
	await page.mouse.move(b.x, b.y, { steps: 8 });
	await page.mouse.up();

	await page.getByRole('button', { name: 'Collapse doc card' }).click();
	await expect.poll(async () => (await cards(page))[0]!.h).toBe(40);
	await expect(page.locator('[data-doccard-body]')).toBeHidden();
	const cardBox = (await page.locator(`[data-element-id="${card.id}"]`).boundingBox())!;
	expect(cardBox.height).toBeCloseTo(40, 0);
	const end = await page.locator('path[data-route]').evaluate((p: SVGPathElement) => {
		const q = p.getPointAtLength(p.getTotalLength());
		const m = p.getScreenCTM()!;
		return { x: q.x * m.a + m.e, y: q.y * m.d + m.f };
	});
	expect(end.y).toBeGreaterThan(cardBox.y - 3);
	expect(end.y).toBeLessThan(cardBox.y + cardBox.height + 3);

	await page.getByRole('button', { name: 'Expand doc card' }).click();
	await expect.poll(async () => (await cards(page))[0]!.h).toBe(card.h);
});

test('copy/paste and undo of a deletion keep the text', async ({ page }) => {
	await createBoard(page);
	await waitForHooks(page);
	await placeCard(page);
	await page.keyboard.type('Remember this');
	await page.keyboard.press('Escape');
	// Escape leaves the card selected.
	await page.keyboard.press('ControlOrMeta+c');
	await page.keyboard.press('ControlOrMeta+v');
	await expect.poll(async () => (await cards(page)).length).toBe(2);
	await expect(page.locator('[data-doccard-body]')).toHaveText(['Remember this', 'Remember this']);

	await page.keyboard.press('Delete'); // the pasted copy is selected
	await expect.poll(async () => (await cards(page)).length).toBe(1);
	await page.keyboard.press('ControlOrMeta+z');
	await expect.poll(async () => (await cards(page)).length).toBe(2);
	await expect(page.locator('[data-doccard-body]')).toHaveText(['Remember this', 'Remember this']);
});
