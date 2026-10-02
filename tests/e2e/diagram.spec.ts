import { expect, test, type Page } from '@playwright/test';
import { clickElement, createBoard, el, enableTestHooks, waitForHooks } from './helpers';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
});

type Snap = {
	id: string;
	type: string;
	kind?: string;
	waypoints?: unknown[];
	from?: { kind: string; elementId?: string };
	to?: { kind: string; elementId?: string };
};
const list = (page: Page) => page.evaluate(() => window.__smthng!.list()) as Promise<Snap[]>;
const selected = (page: Page) => page.evaluate(() => [...window.__smthng!.ctx.selection.ids]);

async function plus(page: Page, port: string) {
	const b = page.locator(`[data-quick-create="${port}"]`);
	await expect(b).toBeVisible();
	await b.click();
}

test('quick-create builds a chain; select connected picks it all', async ({ page }) => {
	await page.evaluate(
		(e) => window.__smthng!.createElements([e as never]),
		el.shape('p0', -500, -50, { kind: 'process' })
	);
	await clickElement(page, 'p0');
	for (let i = 0; i < 3; i++) {
		await plus(page, 'e');
		await page.keyboard.press('Escape'); // leave the new shape's text editor (it stays selected)
	}
	const els = await list(page);
	expect(els.filter((e) => e.type === 'shape')).toHaveLength(4);
	expect(els.filter((e) => e.type === 'shape').every((e) => e.kind === 'process')).toBe(true);
	expect(els.filter((e) => e.type === 'connector')).toHaveLength(3);

	await clickElement(page, 'p0');
	await page.keyboard.press('ControlOrMeta+Shift+a');
	expect(await selected(page)).toHaveLength(7);
});

test('Shift+click on + chooses the new element type', async ({ page }) => {
	await page.evaluate(
		(e) => window.__smthng!.createElements([e as never]),
		el.shape('a', -300, -50)
	);
	await clickElement(page, 'a');
	await page.locator('[data-quick-create="s"]').click({ modifiers: ['Shift'] });
	await page.getByRole('menuitem', { name: 'Sticky note' }).click();
	await page.keyboard.press('Escape');
	expect((await list(page)).map((e) => e.type).sort()).toEqual(['connector', 'shape', 'sticky']);
});

test('dragging an elbow segment adds bends; Reset route removes them', async ({ page }) => {
	await page.evaluate(
		(els) => window.__smthng!.createElements(els as never),
		[el.shape('a', -400, -200), el.shape('b', 100, 100)]
	);
	await clickElement(page, 'a');
	await page.keyboard.press('ControlOrMeta+Alt+ArrowRight');
	await page.keyboard.press('Escape');
	// Connect a → b with the connector tool (an elbow with a middle segment).
	const center = async (id: string) => {
		const r = (await page.locator(`[data-element-id="${id}"]`).boundingBox())!;
		return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
	};
	const a = await center('a');
	const b = await center('b');
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('a');
	await page.mouse.move(a.x, a.y);
	await page.mouse.down();
	await page.mouse.move(b.x, b.y, { steps: 8 });
	await page.mouse.up();
	const conn = (await list(page)).filter((e) => e.type === 'connector').at(-1)!;
	expect(await selected(page)).toEqual([conn.id]);

	const handle = page.locator('[data-handle^="bend:"]').first();
	await expect(handle).toBeAttached();
	const h = (await handle.boundingBox())!;
	await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
	await page.mouse.down();
	await page.mouse.move(h.x + h.width / 2 + 60, h.y + h.height / 2 + 60, { steps: 6 });
	await page.mouse.up();
	await expect
		.poll(async () => ((await list(page)).find((e) => e.id === conn.id)!.waypoints ?? []).length)
		.toBeGreaterThan(0);

	const mid = (await handle.boundingBox())!;
	await page.mouse.click(mid.x + mid.width / 2, mid.y + mid.height / 2, { button: 'right' });
	await page.getByRole('menuitem', { name: 'Reset route' }).click();
	await expect
		.poll(async () => (await list(page)).find((e) => e.id === conn.id)!.waypoints)
		.toEqual([]);
});

test('a mixed diagram: sticky → doc card → sticky → shape, all attached', async ({ page }) => {
	await page.evaluate((e) => window.__smthng!.createElements([e as never]), {
		...el.shape('s', -600, -100),
		type: 'sticky',
		kind: undefined,
		color: '#ffe066',
		text: 'Idea',
		w: 160,
		h: 160
	});
	await clickElement(page, 's');
	for (const choice of ['Doc card', 'Sticky note', 'Rectangle']) {
		await page.locator('[data-quick-create="e"]').click({ modifiers: ['Shift'] });
		await page.getByRole('menuitem', { name: choice, exact: true }).click();
		await page.keyboard.press('Escape');
	}
	const els = await list(page);
	expect(els.map((e) => e.type).filter((t) => t !== 'connector')).toEqual([
		'sticky',
		'doccard',
		'sticky',
		'shape'
	]);
	const conns = els.filter((e) => e.type === 'connector');
	expect(conns).toHaveLength(3);
	expect(conns.every((c) => c.from!.kind !== 'free' && c.to!.kind !== 'free')).toBe(true);
});

test('shapes can be dragged from the library onto the canvas', async ({ page }) => {
	await page
		.getByRole('toolbar', { name: 'Tools' })
		.getByRole('button', { name: 'Shapes' })
		.click();
	const item = page.getByRole('menuitem', { name: 'Database' });
	await expect(item).toBeVisible();
	await item.dragTo(page.getByTestId('canvas'), { targetPosition: { x: 600, y: 300 } });
	await expect.poll(async () => (await list(page))[0]?.kind).toBe('database');
});

test('dragging a + button onto an object of another type connects them', async ({ page }) => {
	await page.evaluate(
		(els) => window.__smthng!.createElements(els as never),
		[
			el.shape('rect', -400, -60),
			{
				...el.shape('note', 0, -100),
				type: 'sticky',
				kind: undefined,
				text: 'Note',
				color: '#ffe066',
				w: 180,
				h: 180
			}
		]
	);
	await clickElement(page, 'rect');
	const plus = (await page.locator('[data-quick-create="e"]').boundingBox())!;
	const note = (await page.locator('[data-element-id="note"]').boundingBox())!;
	await page.mouse.move(plus.x + plus.width / 2, plus.y + plus.height / 2);
	await page.mouse.down();
	await page.mouse.move(note.x + note.width / 2, note.y + note.height / 2, { steps: 8 });
	await page.mouse.up();

	const els = await list(page);
	// A drag connects the two existing objects: nothing is copied.
	expect(els.map((e) => e.type).sort()).toEqual(['connector', 'shape', 'sticky']);
	const conn = els.find((e) => e.type === 'connector')!;
	expect(conn.from).toMatchObject({ kind: 'port', elementId: 'rect' });
	expect(conn.to).toMatchObject({ elementId: 'note' });
	expect(await selected(page)).toEqual([conn.id]);

	// A plain click on + still adds a connected copy.
	await clickElement(page, 'rect');
	await page.locator('[data-quick-create="s"]').click();
	await page.keyboard.press('Escape');
	expect((await list(page)).filter((e) => e.type === 'shape')).toHaveLength(2);
});
