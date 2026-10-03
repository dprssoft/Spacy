import { expect, test, type Page } from '@playwright/test';
import { createBoard, enableTestHooks, waitForHooks } from './helpers';

async function newCard(page: Page) {
	const box = (await page.getByTestId('canvas').boundingBox())!;
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('n');
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	const editor = page.locator('[data-doccard-body] .ProseMirror');
	await expect(editor).toBeFocused();
	return editor;
}

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
});

test('word counts: in the card, for the selection, and in the status bar', async ({ page }) => {
	await newCard(page);
	await page.keyboard.type('One two three four');
	const count = page.locator('[data-doccard-count]');
	await expect(count).toHaveText('4 words · < 1 min read');
	await page.keyboard.press('Shift+ControlOrMeta+ArrowLeft');
	await page.keyboard.press('Shift+ControlOrMeta+ArrowLeft');
	await expect(count).toHaveText('2 of 4 words · < 1 min read');
	await page.keyboard.press('Escape');
	await expect(count).toHaveCount(0);
	await expect(page.getByTestId('status-words')).toHaveText('4 words');
});

test('focus mode: counter with details, and the optional aids persist', async ({ page }) => {
	await newCard(page);
	await page.keyboard.type('First paragraph here.');
	await page.keyboard.press('Enter');
	await page.keyboard.type('Second one.');
	await page.keyboard.press('ControlOrMeta+Enter');
	const focus = page.locator('[data-focus-mode]');
	await expect(focus).toBeVisible();
	await expect(page.getByTestId('focus-count')).toHaveText('5 words · < 1 min read');
	await page.getByTestId('focus-count').click();
	await expect(page.getByTestId('focus-count-details')).toContainText('Paragraphs');

	// All aids are off by default.
	await expect(focus.locator('.focus-paragraph')).toHaveCount(0);

	const option = async (name: string) => {
		await page.getByRole('button', { name: 'View options' }).click();
		await page.getByRole('menuitemcheckbox', { name }).click();
		await page.keyboard.press('Escape');
	};
	await option('Focus paragraph');
	await expect(focus.locator('.focus-paragraph')).toHaveCount(1);
	await page.locator('[data-focus-body] .ProseMirror').click();
	await page.keyboard.press('ControlOrMeta+End');
	const firstP = page.locator('[data-focus-body] .ProseMirror > p').first();
	await expect.poll(() => firstP.evaluate((el) => getComputedStyle(el).opacity)).toBe('0.35');

	await option('Hide interface');
	await page.waitForTimeout(2300);
	const header = page.locator('[data-focus-header]');
	await expect.poll(() => header.evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
	await page.mouse.move(200, 200);
	await expect.poll(() => header.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');

	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('smthng:focus') ?? '{}'))
	).toMatchObject({
		focusParagraph: true,
		hideUi: true,
		typewriter: false
	});
});

test('typewriter scrolling keeps the caret line near 40 % of the height', async ({ page }) => {
	await page.addInitScript(() =>
		localStorage.setItem('smthng:focus', JSON.stringify({ typewriter: true }))
	);
	await page.reload();
	await waitForHooks(page);
	await newCard(page);
	await page.keyboard.press('ControlOrMeta+Enter');
	const body = page.locator('[data-focus-body] .ProseMirror');
	await expect(body).toBeFocused();
	for (let i = 0; i < 30; i++) {
		await page.keyboard.type(`Line ${i}`);
		await page.keyboard.press('Enter');
	}
	await page.keyboard.type('The last line'); // a caret in an empty paragraph has no rectangle
	const ratio = await page.evaluate(() => {
		const sel = getSelection()!.getRangeAt(0).getBoundingClientRect();
		const box = document.querySelector('[data-focus-body]')!.parentElement!.getBoundingClientRect();
		return (sel.top - box.top) / box.height;
	});
	expect(ratio).toBeGreaterThan(0.3);
	expect(ratio).toBeLessThan(0.5);
});
