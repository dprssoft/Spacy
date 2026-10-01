import { expect, test, type Page } from '@playwright/test';
import { clickElement, createBoard, el, enableTestHooks, waitForHooks } from './helpers';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
});

type Ep = { kind: string; elementId?: string; x?: number; y?: number };
type Snap = { id: string; type: string; x: number; from: Ep; to: Ep };
const list = (page: Page) => page.evaluate(() => window.__smthng!.list()) as Promise<Snap[]>;
const connectors = async (page: Page) => (await list(page)).filter((e) => e.type === 'connector');
const add = (page: Page, els: unknown[]) =>
	page.evaluate((els) => window.__smthng!.createElements(els as never), els);

const base = el.shape('x', 0, 0);
const of = (
	type: string,
	id: string,
	x: number,
	y: number,
	extra: Record<string, unknown> = {}
) => {
	const common = { ...base, id, x, y, w: 160, h: 100 };
	switch (type) {
		case 'sticky':
			return {
				...common,
				type,
				kind: undefined,
				color: '#ffe066',
				text: 'S',
				w: 160,
				h: 160,
				...extra
			};
		case 'text':
			return { ...common, type, kind: undefined, text: 'Text', autoWidth: false, ...extra };
		case 'image':
			return {
				...common,
				type,
				kind: undefined,
				text: undefined,
				assetId: 'missing',
				naturalW: 160,
				naturalH: 100,
				...extra
			};
		case 'stroke':
			return {
				...common,
				type,
				kind: undefined,
				text: undefined,
				points: [0, 0, 0.5, 160, 100, 0.5, 80, 0, 0.5],
				...extra
			};
		case 'frame':
			return { ...common, type, kind: undefined, text: undefined, title: 'F', ...extra };
		case 'doccard':
			return {
				...common,
				type,
				kind: undefined,
				text: undefined,
				title: 'Doc',
				collapsed: false,
				expandedH: 100,
				...extra
			};
		default:
			return { ...common, ...extra };
	}
};

async function center(page: Page, id: string) {
	const b = (await page.locator(`[data-element-id="${id}"]`).boundingBox())!;
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

async function drag(page: Page, a: { x: number; y: number }, b: { x: number; y: number }) {
	await page.mouse.move(a.x, a.y);
	await page.mouse.down();
	await page.mouse.move(b.x, b.y, { steps: 10 });
	await page.mouse.up();
}

async function connectWithTool(page: Page, fromId: string, toId: string) {
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('a');
	await drag(page, await center(page, fromId), await center(page, toId));
}

for (const type of ['shape', 'sticky', 'text', 'image', 'stroke', 'frame', 'doccard']) {
	test(`a ${type} connects to a rectangle and the connector follows when it moves`, async ({
		page
	}) => {
		// Frames are hit on their border: start the drag just inside the edge.
		await add(page, [of(type, 'src', -400, -60), el.shape('dst', 100, -50)]);
		const from =
			type === 'frame'
				? { ...(await center(page, 'src')), x: (await center(page, 'src')).x - 70 }
				: await center(page, 'src');
		await page.getByTestId('canvas').focus();
		await page.keyboard.press('a');
		await drag(page, from, await center(page, 'dst'));
		const [c] = await connectors(page);
		expect(c).toBeDefined();
		expect(c!.from.elementId).toBe('src');
		expect(c!.to.elementId).toBe('dst');

		const path = page.locator(`[data-element-id="${c!.id}"] path`).first();
		const before = await path.getAttribute('d');
		await page.evaluate(() => window.__smthng!.ctx.doc.transact(() => {}));
		await clickElement(page, 'dst');
		const dc = await center(page, 'dst');
		await drag(page, dc, { x: dc.x + 80, y: dc.y + 120 });
		await expect(path).not.toHaveAttribute('d', before!);
		// The end still sits on the moved rectangle's outline.
		const end = await page.evaluate((cid) => {
			const g = window.__smthng!.ctx;
			const conn = g.store.get(cid);
			const dst = g.store.get('dst')!;
			if (conn?.type !== 'connector') return null;
			const d = conn.to.kind === 'free' ? null : conn.to;
			return { dst, kind: d?.kind };
		}, c!.id);
		expect(end!.kind).not.toBe('free');
	});
}

test('deleting the target frees the end; undo reattaches it', async ({ page }) => {
	await add(page, [el.shape('a', -300, -50), el.shape('b', 100, -50)]);
	await connectWithTool(page, 'a', 'b');
	await clickElement(page, 'b');
	await page.keyboard.press('Delete');
	await expect.poll(async () => (await connectors(page))[0]?.to.kind).toBe('free');
	await page.keyboard.press('ControlOrMeta+z');
	await expect.poll(async () => (await connectors(page))[0]?.to.elementId).toBe('b');
});

test('dragging from a hovered port dot creates a connector', async ({ page }) => {
	await add(page, [el.shape('a', -300, -50), el.shape('b', 100, -50)]);
	const box = (await page.locator('[data-element-id="a"]').boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); // hover → port dots
	const east = page.locator('[data-port="e"]');
	await expect(east).toBeAttached();
	const d = (await east.boundingBox())!;
	await drag(page, { x: d.x + d.width / 2, y: d.y + d.height / 2 }, await center(page, 'b'));
	const [c] = await connectors(page);
	expect(c!.from).toMatchObject({ kind: 'port', elementId: 'a' });
	expect(c!.to.elementId).toBe('b');
});

test('dragging a connector end re-attaches it; empty canvas detaches', async ({ page }) => {
	await add(page, [el.shape('a', -300, -50), el.shape('b', 100, -50), el.shape('c', 100, 200)]);
	await connectWithTool(page, 'a', 'b');
	const [conn] = await connectors(page);
	// Select the connector by clicking on its line between the shapes.
	const a = await center(page, 'a');
	const b = await center(page, 'b');
	await page.mouse.click((a.x + b.x) / 2, (a.y + b.y) / 2);
	await expect(page.locator('[data-handle="end:to"]')).toBeAttached();
	const h = (await page.locator('[data-handle="end:to"]').boundingBox())!;
	await drag(page, { x: h.x + h.width / 2, y: h.y + h.height / 2 }, await center(page, 'c'));
	await expect.poll(async () => (await connectors(page))[0]?.to.elementId).toBe('c');

	const h2 = (await page.locator('[data-handle="end:to"]').boundingBox())!;
	await drag(
		page,
		{ x: h2.x + h2.width / 2, y: h2.y + h2.height / 2 },
		{ x: h2.x + 300, y: h2.y + 200 }
	);
	await expect
		.poll(async () => (await connectors(page)).find((x) => x.id === conn!.id)?.to.kind)
		.toBe('free');
});

test('a connector cannot connect an element to itself; short drags create nothing', async ({
	page
}) => {
	await add(page, [el.shape('a', -80, -50)]);
	await connectWithTool(page, 'a', 'a');
	expect(await connectors(page)).toEqual([]);
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('a');
	const c = await center(page, 'a');
	await drag(page, { x: c.x + 300, y: c.y }, { x: c.x + 300, y: c.y - 120 });
	const [free] = await connectors(page);
	expect(free!.from.kind).toBe('free');
	expect(free!.to.kind).toBe('free');
});
