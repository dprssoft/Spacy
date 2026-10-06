import { expect, test, type Page } from '@playwright/test';
import { createBoard, el, enableTestHooks, waitForHooks } from './helpers';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
});

type Conn = {
	id: string;
	type: string;
	routing: string;
	markerStart: string;
	markerEnd: string;
	label: { text: string; t: number };
};
const conn = async (page: Page) =>
	((await page.evaluate(() => window.__spacy!.list())) as Conn[]).find(
		(e) => e.type === 'connector'
	)!;

/** Two shapes connected by the connector tool; returns the connector's path locator. */
async function setup(page: Page) {
	await page.evaluate(
		(els) => window.__spacy!.createElements(els as never),
		[el.shape('a', -360, -150), el.shape('b', 160, 60)]
	);
	const center = async (id: string) => {
		const b = (await page.locator(`[data-element-id="${id}"]`).boundingBox())!;
		return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
	};
	const a = await center('a');
	const b = await center('b');
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('a');
	await page.mouse.move(a.x, a.y);
	await page.mouse.down();
	await page.mouse.move(b.x, b.y, { steps: 10 });
	await page.mouse.up();
	const c = await conn(page);
	return page.locator(`[data-element-id="${c.id}"] path[data-route]`);
}

/** Clicks the midpoint of the connector's route (by asking the app where it is). */
async function clickConnector(page: Page, button: 'left' | 'right' = 'left', clickCount = 1) {
	const path = page.locator('path[data-route]').first();
	// SVGPoint doesn't serialize out of the page: return a plain object.
	const pt = await path.evaluate((el: SVGPathElement) => {
		const q = el.getPointAtLength(el.getTotalLength() * 0.5);
		return { x: q.x, y: q.y };
	});
	const canvas = (await page.getByTestId('canvas').boundingBox())!;
	const vp = await page.evaluate(() => window.__spacy!.ctx.viewport.vp);
	await page.mouse.click(canvas.x + pt.x * vp.zoom + vp.x, canvas.y + pt.y * vp.zoom + vp.y, {
		button,
		clickCount
	});
}

test('new connectors are elbows; switching routing changes the path', async ({ page }) => {
	const path = await setup(page);
	expect((await conn(page)).routing).toBe('elbow');
	await clickConnector(page);
	await page.getByTestId('style-connector').click();
	const before = await path.getAttribute('d');
	await page.getByRole('radio', { name: 'Curve', exact: true }).click();
	await expect(path).toHaveAttribute('d', /C/);
	await page.getByRole('radio', { name: 'Straight', exact: true }).click();
	await expect(path).not.toHaveAttribute('d', /C/);
	expect(await path.getAttribute('d')).not.toBe(before);
	expect((await conn(page)).routing).toBe('straight');
});

test('markers can be changed at both ends', async ({ page }) => {
	await setup(page);
	await clickConnector(page);
	await page.getByTestId('style-connector').click();
	await page.getByRole('radio', { name: 'End marker: Diamond' }).click();
	await page.getByRole('radio', { name: 'Start marker: Circle' }).click();
	expect(await conn(page)).toMatchObject({ markerEnd: 'diamond', markerStart: 'circle' });
	const c = await conn(page);
	// Path + two marker paths.
	await expect(page.locator(`[data-element-id="${c.id}"] path`)).toHaveCount(3);
});

test('double-click a connector to label it; the label can be dragged along it', async ({
	page
}) => {
	await setup(page);
	await clickConnector(page);
	await clickConnector(page, 'left', 2);
	const input = page.getByRole('textbox', { name: 'Connector label' });
	await expect(input).toBeFocused();
	await input.fill('yes');
	await input.press('Enter');
	const c = await conn(page);
	expect(c.label.text).toBe('yes');
	const label = page.locator(`[data-element-id="${c.id}"] [data-connector-label]`);
	await expect(label).toHaveText('yes');

	// Drag the label (connector still selected) along the path.
	const lb = (await label.boundingBox())!;
	await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2);
	await page.mouse.down();
	await page.mouse.move(lb.x + lb.width / 2 - 200, lb.y + lb.height / 2 - 120, { steps: 8 });
	await page.mouse.up();
	expect((await conn(page)).label.t).toBeLessThan(0.4);
});

test('"Set as default" on a connector applies its routing to new connectors', async ({ page }) => {
	await setup(page);
	await clickConnector(page);
	await page.getByTestId('style-connector').click();
	await page.getByRole('radio', { name: 'Curve', exact: true }).click();
	await page.keyboard.press('Escape');
	await page.getByTestId('style-more').click();
	await page.getByRole('button', { name: 'Set as default for new connectors' }).click();
	await page.keyboard.press('Escape');
	const created = await page.evaluate(() => {
		const ctx = window.__spacy!.ctx;
		return ctx.store.elements.size;
	});
	expect(created).toBe(3);
	// Draw another connector from empty canvas.
	const box = (await page.getByTestId('canvas').boundingBox())!;
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('a');
	await page.mouse.move(box.x + 100, box.y + 500);
	await page.mouse.down();
	await page.mouse.move(box.x + 300, box.y + 550, { steps: 5 });
	await page.mouse.up();
	const all = (await page.evaluate(() => window.__spacy!.list())) as Conn[];
	expect(all.filter((e) => e.type === 'connector').map((e) => e.routing)).toEqual([
		'curve',
		'curve'
	]);
});
