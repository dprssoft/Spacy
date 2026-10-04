import { expect, test, type Page } from '@playwright/test';
import { createBoard, enableTestHooks, waitForHooks, waitForInitialView } from './helpers';

const noOverflow = (page: Page) =>
	page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function expectTarget(page: Page, name: string | RegExp) {
	const el = page.getByRole('button', { name }).first();
	await expect(el).toBeVisible();
	const box = (await el.boundingBox())!;
	const vw = page.viewportSize()!.width;
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(vw + 0.5);
	expect(Math.min(box.width, box.height), String(name)).toBeGreaterThanOrEqual(43.5);
}

for (const width of [360, 412]) {
	test.describe(`${width} px wide`, () => {
		test.use({ viewport: { width, height: 800 } });

		test('the start page fits, with every view and action reachable', async ({ page }) => {
			await page.addInitScript(() => localStorage.setItem('smthng:onboarded', 'true'));
			await page.goto('/');
			await expect(page.getByRole('button', { name: /New board/ })).toBeVisible();
			expect(await noOverflow(page)).toBe(true);
			for (const view of ['Recent', 'Starred', 'All boards', 'Trash']) {
				const link = page.getByRole('link', { name: view });
				await expect(link).toBeInViewport({ ratio: 1 });
			}
			await expect(page.getByRole('searchbox', { name: 'Search boards' })).toBeVisible();
			await expectTarget(page, 'Settings');
		});

		test('a board fits: top bar, bottom toolbar and status bar, touch-sized', async ({ page }) => {
			await enableTestHooks(page);
			await createBoard(page);
			await waitForHooks(page);
			expect(await noOverflow(page)).toBe(true);
			for (const name of [
				'Undo',
				'Redo',
				'Settings',
				/^Export/,
				'Back to origin',
				'Zoom in',
				'Zoom out'
			]) {
				await expectTarget(page, name);
			}
			for (const name of [
				/^Select/,
				/^Hand/,
				/^Pen/,
				/^Shapes/,
				/^Sticky note/,
				/^Text/,
				'Insert more'
			])
				await expectTarget(page, name);
			// The toolbar is at the bottom (below the canvas).
			const toolbar = (await page.getByRole('toolbar', { name: 'Tools' }).boundingBox())!;
			const canvas = (await page.getByTestId('canvas').boundingBox())!;
			expect(toolbar.y).toBeGreaterThan(canvas.y + canvas.height - 1);
			// The title keeps room.
			const title = (await page.getByRole('button', { name: /^Rename board/ }).boundingBox())!;
			expect(title.width).toBeGreaterThan(60);
		});

		test('secondary tools, media and templates are in the Insert menu', async ({ page }) => {
			await enableTestHooks(page);
			await createBoard(page);
			await waitForHooks(page);
			await page.getByRole('button', { name: 'Insert more' }).click();
			for (const item of [
				'Sketch',
				'Eraser',
				'Connector',
				'Doc card',
				'Frame',
				'Image',
				'Media…',
				'Templates…'
			])
				await expect(page.getByRole('menuitem', { name: item })).toBeVisible();
			await page.getByRole('menuitem', { name: 'Media…' }).click();
			const field = page.getByRole('textbox', { name: 'Media link' });
			await expect(field).toBeInViewport({ ratio: 1 });
			await page.keyboard.press('Escape');

			await page.getByRole('button', { name: 'Insert more' }).click();
			await page.getByRole('menuitem', { name: 'Templates…' }).click();
			await expect(page.getByRole('dialog', { name: 'Insert template' })).toBeVisible();
			expect(await noOverflow(page)).toBe(true);
			await page.getByRole('button', { name: 'Kanban template' }).click();
			await expect(page.locator('[data-type=frame]')).toHaveCount(3);
		});
	});
}

test('Back to origin returns the view to the origin at 100 %', async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await waitForInitialView(page);
	const home = await page.evaluate(() => window.__smthng!.ctx.viewport.vp);
	await page.evaluate(() => window.__smthng!.ctx.viewport.set({ x: -3000, y: 2000, zoom: 0.4 }));
	await page.getByRole('button', { name: 'Back to origin' }).click();
	await expect.poll(() => page.evaluate(() => window.__smthng!.ctx.viewport.vp)).toEqual(home);
});

test('the outline opens as a sheet on phones', async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await page.getByTestId('outline-toggle').click();
	const panel = page.getByTestId('outline-panel');
	await expect(panel).toBeVisible();
	expect((await panel.boundingBox())!.width).toBeGreaterThan(page.viewportSize()!.width - 2);
	await page.getByRole('button', { name: 'Close outline' }).click();
	await expect(panel).toHaveCount(0);
});
