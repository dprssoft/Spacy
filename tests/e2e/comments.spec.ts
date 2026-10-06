import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
	clickElement,
	createBoard,
	el,
	enableTestHooks,
	waitForHooks,
	waitForInitialView
} from './helpers';

test.beforeEach(async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await waitForInitialView(page);
});

const sticky = (id: string, x: number, y: number, text: string) => ({
	...el.shape(id, x, y),
	type: 'sticky',
	kind: undefined,
	text,
	color: '#ffe066',
	w: 180,
	h: 180
});
const add = (page: Page, e: object) =>
	page.evaluate((e) => window.__spacy!.createElements([e as never]), e);

const popover = (page: Page) => page.getByRole('dialog', { name: 'Comments' });

/** Writes the first comment in the open popover (asking for the name the first time). */
async function writeFirst(page: Page, text: string) {
	const p = popover(page);
	const name = p.locator('[data-comment-name]');
	if (await name.isVisible()) await name.fill('Ann');
	await p.getByRole('textbox', { name: /Add a comment/ }).fill(text);
	await p.getByRole('button', { name: 'Comment', exact: true }).click();
}

test('comment on a sticky: badge, reply, resolve, reopen; deleting the sticky removes it', async ({
	page
}) => {
	await add(page, sticky('s', -90, -90, 'Plot twist'));
	await clickElement(page, 's');
	await page.keyboard.press('ControlOrMeta+Alt+m');
	await expect(popover(page)).toBeVisible();
	await writeFirst(page, 'Is this too early?');

	const badge = page.locator('[data-comment-badge="s"]');
	await expect(badge).toHaveText('1');
	const thread = popover(page).locator('[data-comment-thread]');
	await expect(thread).toContainText('Ann');
	await expect(thread).toContainText('Is this too early?');

	// The name is asked only once.
	await thread.getByRole('textbox', { name: 'Reply' }).fill('Move it to act two');
	await thread.getByRole('button', { name: 'Reply', exact: true }).click();
	await expect(thread.locator('[data-comment-message]')).toHaveCount(2);
	await expect(popover(page).locator('[data-comment-name]')).toHaveCount(0);

	await thread.getByRole('button', { name: 'Resolve' }).click();
	await expect(badge).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(popover(page)).toHaveCount(0);

	await page.getByTestId('comments-toggle').click();
	const panel = page.getByTestId('comments-panel');
	await expect(panel.locator('[data-comments-row]')).toHaveCount(0);
	await panel.locator('[data-comments-filter="resolved"]').click();
	await expect(panel.locator('[data-comments-row]')).toHaveCount(1);
	await expect(panel.locator('[data-comments-row]')).toContainText('Is this too early?');
	await expect(panel.locator('[data-comments-row]')).toContainText('1 reply');
	const axe = await new AxeBuilder({ page }).include('[data-testid="comments-panel"]').analyze();
	expect(axe.violations).toEqual([]);
	await panel.locator('[data-comments-row]').click();
	await popover(page).getByRole('button', { name: 'Reopen' }).click();
	await expect(badge).toHaveText('1');

	// Undo reopens → resolved again; redo.
	await page.keyboard.press('Escape');
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('ControlOrMeta+z');
	await expect(badge).toHaveCount(0);
	await page.keyboard.press('ControlOrMeta+Shift+z');
	await expect(badge).toHaveText('1');

	await clickElement(page, 's');
	await page.keyboard.press('Delete');
	await expect(badge).toHaveCount(0);
	expect(await page.evaluate(() => window.__spacy!.ctx.comments.threads.length)).toBe(0);
	await page.keyboard.press('ControlOrMeta+z');
	await expect(badge).toHaveText('1');
});

test('comment on text in a doc card; the highlight follows edits and opens the thread', async ({
	page
}) => {
	const box = (await page.getByTestId('canvas').boundingBox())!;
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('n');
	await page.mouse.click(box.x + box.width / 2 - 150, box.y + box.height / 2 - 60);
	const editor = page.locator('[data-doccard-body] .ProseMirror');
	await expect(editor).toBeFocused();
	await page.keyboard.type('The dragon sleeps.');
	// Select "dragon".
	await page.keyboard.press('Home');
	for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
	for (let i = 0; i < 6; i++) await page.keyboard.press('Shift+ArrowRight');
	await page.locator('[data-bubble-comment]').click();
	await expect(popover(page)).toContainText('dragon');
	await writeFirst(page, 'Name the dragon');

	const mark = editor.locator('.comment-mark');
	await expect(mark).toHaveText('dragon');
	await page.keyboard.press('Escape');

	// Typing before it moves the highlight along with its text.
	await editor.click();
	await page.keyboard.press('ControlOrMeta+Home');
	await page.keyboard.type('Once, ');
	await expect(editor).toContainText('Once, The dragon sleeps.');
	await expect(mark).toHaveText('dragon');

	await mark.click();
	await expect(popover(page).locator('[data-comment-quote]')).toHaveText('dragon');
	await expect(popover(page)).toContainText('Name the dragon');
	await page.keyboard.press('Escape');
	await page.keyboard.press('Escape');

	// The card's badge counts its text comments; the panel lists the thread with its quote.
	const card = await page.evaluate(
		() => window.__spacy!.list().find((e) => e.type === 'doccard')!.id
	);
	await expect(page.locator(`[data-comment-badge="${card}"]`)).toHaveText('1');
	await page.getByTestId('comments-toggle').click();
	await expect(page.getByTestId('comments-panel').locator('[data-comments-row]')).toContainText(
		'dragon'
	);
});

test('comments travel in .spacy export and import', async ({ page }) => {
	await add(page, sticky('s', -90, -90, 'Keep me'));
	await clickElement(page, 's');
	await page.keyboard.press('ControlOrMeta+Alt+m');
	await writeFirst(page, 'Exported comment');
	await page.keyboard.press('Escape');

	await page.getByRole('button', { name: 'Export' }).click();
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('menuitem', { name: 'Download .spacy' }).click()
	]);
	const path = (await download.path())!;

	await page.goto('/');
	await page.getByTestId('import-input').setInputFiles(path);
	await expect(page.getByText(/Imported/)).toBeVisible();
	await page.locator('article').first().getByRole('link').first().click();
	await waitForHooks(page);
	await expect(page.locator('[data-comment-badge="s"]')).toHaveText('1');
	await page.locator('[data-comment-badge="s"]').click();
	await expect(popover(page)).toContainText('Exported comment');
});

test('duplicating a commented object copies its comments', async ({ page }) => {
	await add(page, sticky('s', -200, -90, 'Original'));
	await clickElement(page, 's');
	await page.keyboard.press('ControlOrMeta+Alt+m');
	await writeFirst(page, 'Copied along');
	await page.keyboard.press('Escape');
	await clickElement(page, 's');
	await page.keyboard.press('ControlOrMeta+d');
	await expect(page.locator('[data-comment-badge]')).toHaveCount(2);
});
