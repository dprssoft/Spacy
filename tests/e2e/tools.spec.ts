import { expect, test } from '@playwright/test';
import { clickElement, createBoard, el, enableTestHooks, waitForHooks } from './helpers';

test('tool shortcuts switch tools; Escape returns to select', async ({ page }) => {
	await createBoard(page);
	const toolbar = page.getByRole('toolbar', { name: 'Tools' });
	await expect(toolbar.getByRole('button', { name: 'Select' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	await page.getByTestId('canvas').focus();
	await page.keyboard.press('h');
	await expect(toolbar.getByRole('button', { name: 'Hand' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(toolbar.getByRole('button', { name: 'Select' })).toHaveAttribute(
		'aria-pressed',
		'false'
	);

	await page.keyboard.press('Escape');
	await expect(toolbar.getByRole('button', { name: 'Select' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});

test('every tool is available; N picks the doc card tool', async ({ page }) => {
	// Until step 23 this checked that unbuilt tools were disabled; all tools now exist.
	await createBoard(page);
	const toolbar = page.getByRole('toolbar', { name: 'Tools' });
	await expect(toolbar.locator('[aria-disabled="true"]')).toHaveCount(0);
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('n');
	await expect(toolbar.getByRole('button', { name: 'Doc card' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});

test('clicking toolbar buttons selects tools; the hand tool pans', async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await page.evaluate((e) => window.__spacy!.createElements([e as never]), el.shape('probe', 0, 0));
	const probe = page.locator('[data-element-id="probe"]');
	const before = (await probe.boundingBox())!;

	await page.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: 'Hand' }).click();
	const box = (await page.getByTestId('canvas').boundingBox())!;
	await page.mouse.move(box.x + 600, box.y + 400);
	await page.mouse.down();
	await page.mouse.move(box.x + 640, box.y + 380, { steps: 4 });
	await page.mouse.up();
	const after = (await probe.boundingBox())!;
	expect(after.x - before.x).toBeCloseTo(40, 0);
	expect(after.y - before.y).toBeCloseTo(-20, 0);
});

test('clicking an element selects it, Shift toggles, empty canvas clears', async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await page.evaluate(
		(els) => window.__spacy!.createElements(els as never),
		[el.shape('a', -300, -50), el.shape('b', 100, -50)]
	);
	const selected = () => page.evaluate(() => [...window.__spacy!.ctx.selection.ids].sort());

	await clickElement(page, 'a');
	expect(await selected()).toEqual(['a']);
	await clickElement(page, 'b', ['Shift']);
	expect(await selected()).toEqual(['a', 'b']);
	await clickElement(page, 'a', ['Shift']);
	expect(await selected()).toEqual(['b']);

	const box = (await page.getByTestId('canvas').boundingBox())!;
	await page.mouse.click(box.x + 60, box.y + 60);
	expect(await selected()).toEqual([]);
});

test('shortcuts are ignored while typing in the title', async ({ page }) => {
	await createBoard(page);
	await page.getByRole('button', { name: /^Rename board:/ }).click();
	await page.getByRole('textbox', { name: 'Board title' }).fill('Hh');
	await expect(
		page.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: 'Select' })
	).toHaveAttribute('aria-pressed', 'true');
});

test('the toolbar is keyboard-operable', async ({ page }) => {
	await createBoard(page);
	const hand = page.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: 'Hand' });
	await hand.focus();
	await page.keyboard.press('Enter');
	await expect(hand).toHaveAttribute('aria-pressed', 'true');
});
