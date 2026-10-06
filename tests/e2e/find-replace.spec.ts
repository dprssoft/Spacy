import { expect, test, type Page } from '@playwright/test';
import { createBoard, el, enableTestHooks, waitForHooks, waitForInitialView } from './helpers';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await waitForInitialView(page);
	await page.evaluate(
		(els) => window.__spacy!.createElements(els as never),
		[
			{
				...el.shape('st', -400, -150),
				type: 'sticky',
				kind: undefined,
				text: 'Mara waits',
				color: '#ffe066',
				w: 160,
				h: 160
			},
			{
				...el.shape('fr', 100, -200),
				type: 'frame',
				kind: undefined,
				text: undefined,
				title: "Mara's room",
				w: 300,
				h: 200
			}
		]
	);
});

async function docCardSaying(page: Page, text: string, dx: number) {
	const box = (await page.getByTestId('canvas').boundingBox())!;
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('n');
	await page.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + 100);
	await expect(page.locator('[data-doccard-body] .ProseMirror:focus')).toBeVisible();
	await page.keyboard.type(text);
	await page.keyboard.press('Escape');
}

const texts = (page: Page) =>
	page.evaluate(() => {
		const ctx = window.__spacy!.ctx;
		const s = ctx.store.get('st') as { text: string };
		const f = ctx.store.get('fr') as { title: string };
		const bodies = [...document.querySelectorAll('[data-doccard-body]')].map((n) => n.textContent);
		return [s.text, f.title, ...bodies];
	});

test('find everything, replace all in one undo step; Mod+F works inside a doc card', async ({
	page
}) => {
	await docCardSaying(page, 'Mara speaks.', -250);
	await docCardSaying(page, 'Not here, Mara.', 250);

	await page.getByTestId('canvas').focus();
	await page.keyboard.press('ControlOrMeta+f');
	const panel = page.getByTestId('find-panel');
	await expect(panel.getByRole('textbox', { name: 'Find' })).toBeFocused();
	await page.keyboard.type('Mara');
	await expect(panel.getByTestId('find-status')).toHaveText('1 of 4 matches in 4 objects');
	await panel.getByRole('button', { name: 'Next match' }).click();
	await expect(panel.getByTestId('find-status')).toHaveText('2 of 4 matches in 4 objects');

	await panel.getByRole('textbox', { name: 'Replace with' }).fill('Lena');
	await panel.getByRole('button', { name: 'All', exact: true }).click();
	await expect
		.poll(() => texts(page))
		.toEqual(['Lena waits', "Lena's room", 'Lena speaks.', 'Not here, Lena.']);
	await expect(panel.getByTestId('find-status')).toHaveText('No matches');

	await page.getByTestId('canvas').focus();
	await page.keyboard.press('ControlOrMeta+z');
	await expect
		.poll(() => texts(page))
		.toEqual(['Mara waits', "Mara's room", 'Mara speaks.', 'Not here, Mara.']);

	// Inside a doc card being edited, Mod+F opens the panel instead of the browser's find.
	await panel.getByRole('button', { name: 'Close find' }).click();
	await expect(panel).toHaveCount(0);
	await page.evaluate(() => {
		const ctx = window.__spacy!.ctx;
		const card = [...ctx.store.elements.values()].find((e) => e.type === 'doccard')!;
		ctx.selection.set([card.id]);
		ctx.viewport.set({
			...ctx.viewport.vp,
			x: ctx.viewport.size.w / 2 - card.x - 100,
			y: 200 - card.y
		});
	});
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('Enter');
	await expect(page.locator('[data-doccard-body] .ProseMirror:focus')).toBeVisible();
	await page.keyboard.press('ControlOrMeta+f');
	await expect(page.getByTestId('find-panel')).toBeVisible();
});

test('whole word, regex errors, and searching all pages', async ({ page }) => {
	await page.keyboard.press('ControlOrMeta+f');
	const panel = page.getByTestId('find-panel');
	const find = panel.getByRole('textbox', { name: 'Find' });
	await find.fill('(a+)+$');
	await panel.getByRole('button', { name: '.*' }).click();
	await expect(panel.getByTestId('find-status')).toHaveText('This pattern could be very slow');
	await panel.getByRole('button', { name: '.*' }).click();

	// Another page with a Mara sticky.
	await page.evaluate(
		(e) => {
			const ctx = window.__spacy!.ctx;
			const first = ctx.pages.current;
			ctx.pages.add();
			window.__spacy!.createElements([e as never]);
			ctx.pages.select(first);
		},
		{
			...el.shape('other', 0, 0),
			type: 'sticky',
			kind: undefined,
			text: 'Mara elsewhere',
			color: '#ffe066',
			w: 160,
			h: 160
		}
	);
	await find.fill('Mara');
	await expect(panel.getByTestId('find-status')).toContainText('of 2 matches');
	await panel.getByLabel('All pages').check();
	await expect(panel.getByTestId('find-status')).toContainText('of 3 matches');
	await panel
		.getByTestId('find-results')
		.getByRole('button', { name: /elsewhere/ })
		.click();
	await expect
		.poll(() => page.evaluate(() => [...window.__spacy!.ctx.selection.ids]))
		.toEqual(['other']);
});
