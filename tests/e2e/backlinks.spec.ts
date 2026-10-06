import { expect, test, type Page } from '@playwright/test';
import { createBoard, el, enableTestHooks, waitForHooks, waitForInitialView } from './helpers';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await waitForInitialView(page);
});

/** A new doc card at a screen offset from the canvas centre, mentioning `who`. */
async function sceneMentioning(page: Page, dx: number, who: string) {
	const box = (await page.getByTestId('canvas').boundingBox())!;
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('n');
	await page.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + 120);
	await expect(page.locator('[data-doccard-body] .ProseMirror:focus')).toBeVisible();
	await page.keyboard.type(`Meet @${who.slice(0, 3)}`);
	await expect(page.getByRole('listbox', { name: 'Objects' }).getByRole('option')).toHaveText([
		who
	]);
	await page.keyboard.press('Enter');
	await page.keyboard.type(' at the gate.');
	await page.keyboard.press('Escape');
}

test('a character card shows where it is mentioned; a backlink opens the scene at the mention', async ({
	page
}) => {
	await page.evaluate((e) => window.__spacy!.createElements([e as never]), {
		...el.shape('mara', -180, -200),
		type: 'doccard',
		kind: undefined,
		text: undefined,
		title: 'Mara',
		collapsed: false,
		expandedH: 160,
		w: 360,
		h: 160
	});
	await sceneMentioning(page, -260, 'Mara');
	await sceneMentioning(page, 260, 'Mara');

	const badge = page.locator('[data-element-id="mara"] [data-testid="backlinks-badge"]');
	await expect(badge).toHaveText('2');
	await badge.click();
	const list = page.getByTestId('backlinks');
	await expect(list.getByRole('button')).toHaveCount(2);
	await expect(list.getByRole('button').first()).toContainText('Meet @Mara at the gate.');
	await list.getByRole('button').first().click();
	const selected = await page.evaluate(() => [...window.__spacy!.ctx.selection.ids]);
	expect(selected).toHaveLength(1);
	expect(selected[0]).not.toBe('mara');
	await expect(
		page.locator(`[data-element-id="${selected[0]}"] .mention[data-id="mara"]`)
	).toHaveClass(/mention-flash/);

	// The context menu offers the same list for the selected object.
	// Back to the start (the backlink flew the view to the scene).
	await page.getByRole('button', { name: 'Back to origin' }).click();
	await page.waitForTimeout(400);
	const card = (await page.locator('[data-element-id="mara"]').boundingBox())!;
	await page.mouse.click(card.x + card.width / 2, card.y + card.height - 20, { button: 'right' });
	await page.getByRole('menuitem', { name: 'Mentioned in 2…' }).click();
	await expect(page.getByRole('dialog', { name: 'Mentioned in' }).getByRole('button')).toHaveCount(
		2
	);
});
