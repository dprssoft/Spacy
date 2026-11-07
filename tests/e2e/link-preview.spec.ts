import { expect, test, type Page } from '@playwright/test';
import { createBoard, enableTestHooks, waitForHooks } from './helpers';

const SITE = 'https://example.test/page';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await page.route('https://example.test/**', (route) =>
		route.fulfill({ contentType: 'text/html', body: '<h1>Example site</h1>' })
	);
	await createBoard(page);
	await waitForHooks(page);
});

/** A doc card with one linked word; returns the editor. */
async function linkedCard(page: Page) {
	const box = (await page.getByTestId('canvas').boundingBox())!;
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('n');
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	const editor = page.locator('[data-doccard-body] .ProseMirror');
	await expect(editor).toBeFocused();
	await page.keyboard.type('word');
	await page.keyboard.press('Shift+Home');
	await page.getByRole('button', { name: 'Link', exact: true }).click();
	await page.getByRole('textbox', { name: 'Link URL' }).fill(SITE);
	await page.keyboard.press('Enter');
	return editor;
}

test('a link can show its page under it, and that is saved', async ({ page }) => {
	const editor = await linkedCard(page);
	const button = page.getByRole('button', { name: 'Page preview' });
	await expect(button).toHaveAttribute('aria-pressed', 'false');
	await expect(editor.locator('iframe')).toHaveCount(0);

	await button.click();
	await expect(button).toHaveAttribute('aria-pressed', 'true');
	const frame = editor.frameLocator('iframe');
	await expect(frame.getByRole('heading', { name: 'Example site' })).toBeVisible();
	await expect(editor.locator('iframe')).toHaveAttribute('sandbox', /allow-scripts/);
	await expect(editor.getByRole('link', { name: 'Open in new tab' })).toHaveAttribute(
		'rel',
		'noopener noreferrer'
	);

	await button.click();
	await expect(editor.locator('iframe')).toHaveCount(0);
});

test('hover previews are off until turned on in Settings', async ({ page }) => {
	const popup = page.locator('body > [data-link-preview]');
	const editor = await linkedCard(page);
	await editor.getByRole('link', { name: 'word' }).hover();
	await page.waitForTimeout(700);
	await expect(popup).toHaveCount(0);

	await page.getByRole('button', { name: 'Settings' }).click();
	await page.getByRole('menuitemcheckbox', { name: /Preview links on hover/ }).click();
	await page.keyboard.press('Escape');
	// Opening Settings ended the editing, and only a card being edited takes the pointer.
	const card = (await page.locator('[data-doccard-body]').boundingBox())!;
	await page.mouse.dblclick(card.x + card.width / 2, card.y + card.height - 20);
	await expect(editor).toBeFocused();
	await page.mouse.move(5, 5);
	await editor.getByRole('link', { name: 'word' }).hover();
	await expect(popup.frameLocator('iframe').getByRole('heading')).toHaveText('Example site');
	await page.mouse.move(5, 300);
	await expect(popup).toHaveCount(0);
});
