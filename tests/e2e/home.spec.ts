import { expect, test, type Page } from '@playwright/test';
import { createBoard } from './helpers';

const card = (page: Page, title: string) =>
	page.locator('article', { has: page.getByRole('heading', { name: title, exact: true }) });

async function openMenu(page: Page, title: string) {
	const c = card(page, title).first();
	await c.hover();
	await c.getByRole('button', { name: 'Board actions' }).click();
}

async function renameVia(page: Page, from: string, to: string) {
	await openMenu(page, from);
	await page.getByRole('menuitem', { name: 'Rename' }).click();
	const input = page.getByRole('textbox', { name: 'Board title' });
	await input.fill(to);
	await input.press('Enter');
	await expect(card(page, to)).toBeVisible();
}

async function createBoards(page: Page, n: number) {
	for (let i = 0; i < n; i++) await createBoard(page);
	await page.goto('/');
	await expect(page.locator('article')).toHaveCount(n);
}

test('first visit shows the empty state and the New board card', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'No boards yet' })).toBeVisible();
	await expect(page.getByRole('button', { name: /New board/ })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Recent' })).toHaveAttribute('aria-current', 'page');
});

test('New board creates a board, opens it, and it appears in Recent', async ({ page }) => {
	const id = await createBoard(page);
	expect(id).toMatch(/^[\w-]{12}$/);
	await expect(page.getByRole('button', { name: 'Rename board: Untitled board' })).toBeVisible();

	await page.goBack();
	await expect(page).toHaveURL('/');
	await expect(page.getByRole('link', { name: 'Open Untitled board' })).toBeVisible();
	await expect(card(page, 'Untitled board')).toContainText('Edited just now');
	await expect(page.getByRole('heading', { name: 'No boards yet' })).toBeHidden();
});

test('views switch through the URL and the back button', async ({ page }) => {
	await createBoard(page);
	await page.goto('/');
	await page.getByRole('link', { name: 'Starred' }).click();
	await expect(page).toHaveURL('/?view=starred');
	await expect(page.getByRole('heading', { name: 'No starred boards' })).toBeVisible();
	await expect(page.getByRole('button', { name: /New board/ })).toBeHidden();

	await page.getByRole('link', { name: 'Trash' }).click();
	await expect(page.getByRole('heading', { name: 'Trash is empty' })).toBeVisible();

	await page.goBack();
	await expect(page.getByRole('heading', { name: 'No starred boards' })).toBeVisible();
	await page.goBack();
	await expect(page.getByRole('link', { name: 'Open Untitled board' })).toBeVisible();
});

test('boards created in another tab appear without reloading', async ({ page, context }) => {
	await page.goto('/');
	const other = await context.newPage();
	await createBoard(other);
	await expect(page.getByRole('link', { name: 'Open Untitled board' })).toBeVisible();
});

test('board lifecycle: rename, star, duplicate, trash, restore, delete forever', async ({
	page
}) => {
	await createBoards(page, 3);
	await renameVia(page, 'Untitled board', 'Roadmap');

	// Star → appears in Starred.
	await card(page, 'Roadmap').hover();
	await card(page, 'Roadmap').getByRole('button', { name: 'Star board' }).click();
	await expect(card(page, 'Roadmap').getByRole('button', { name: 'Unstar board' })).toBeVisible();
	await page.getByRole('link', { name: 'Starred' }).click();
	await expect(page.locator('article')).toHaveCount(1);
	await expect(card(page, 'Roadmap')).toBeVisible();

	// Duplicate.
	await page.getByRole('link', { name: 'Recent' }).click();
	await openMenu(page, 'Roadmap');
	await page.getByRole('menuitem', { name: 'Duplicate' }).click();
	await expect(card(page, 'Roadmap (copy)')).toBeVisible();
	await expect(page.locator('article')).toHaveCount(4);

	// Trash → Undo from the toast restores it.
	await openMenu(page, 'Roadmap');
	await page.getByRole('menuitem', { name: 'Move to trash' }).click();
	await expect(card(page, 'Roadmap')).toBeHidden();
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(card(page, 'Roadmap')).toBeVisible();

	// Trash → restore from the Trash view.
	await openMenu(page, 'Roadmap');
	await page.getByRole('menuitem', { name: 'Move to trash' }).click();
	await page.getByRole('link', { name: 'Trash' }).click();
	await expect(card(page, 'Roadmap')).toContainText('Deleted just now');
	await openMenu(page, 'Roadmap');
	await page.getByRole('menuitem', { name: 'Restore' }).click();
	await expect(page.getByRole('heading', { name: 'Trash is empty' })).toBeVisible();

	// Trash → delete forever.
	await page.getByRole('link', { name: 'Recent' }).click();
	await openMenu(page, 'Roadmap');
	await page.getByRole('menuitem', { name: 'Move to trash' }).click();
	await page.getByRole('link', { name: 'Trash' }).click();
	await openMenu(page, 'Roadmap');
	await page.getByRole('menuitem', { name: 'Delete forever' }).click();
	await expect(page.getByRole('alertdialog')).toContainText('Delete “Roadmap” forever?');
	await page.getByRole('button', { name: 'Delete forever' }).click();
	await expect(page.getByRole('heading', { name: 'Trash is empty' })).toBeVisible();

	await page.getByRole('link', { name: 'All boards' }).click();
	await expect(page.locator('article')).toHaveCount(3);
	await expect(card(page, 'Roadmap')).toBeHidden();
});

test('trashed boards do not open', async ({ page }) => {
	await createBoards(page, 1);
	await openMenu(page, 'Untitled board');
	await page.getByRole('menuitem', { name: 'Move to trash' }).click();
	await page.getByRole('link', { name: 'Trash' }).click();
	await page.getByRole('button', { name: 'Untitled board (in trash)' }).click();
	await expect(page.getByText('Restore the board to open it')).toBeVisible();
	await expect(page).toHaveURL('/?view=trash');
});

test('Empty trash deletes all trashed boards', async ({ page }) => {
	await createBoards(page, 2);
	for (let i = 0; i < 2; i++) {
		await openMenu(page, 'Untitled board');
		await page.getByRole('menuitem', { name: 'Move to trash' }).click();
		await expect(page.locator('article')).toHaveCount(1 - i);
	}
	await page.getByRole('link', { name: 'Trash' }).click();
	await page.getByRole('button', { name: 'Empty trash' }).click();
	await expect(page.getByRole('alertdialog')).toContainText('Delete 2 boards forever?');
	await page.getByRole('button', { name: 'Delete forever' }).click();
	await expect(page.getByRole('heading', { name: 'Trash is empty' })).toBeVisible();
});

test('search, sort by name and layout toggle', async ({ page }) => {
	await createBoards(page, 3);
	await renameVia(page, 'Untitled board', 'Beta');
	await renameVia(page, 'Untitled board', 'alpha');
	await renameVia(page, 'Untitled board', 'Gamma plan');

	await page.getByRole('searchbox', { name: 'Search boards' }).fill('PLAN');
	await expect(page.locator('article')).toHaveCount(1);
	await expect(card(page, 'Gamma plan')).toBeVisible();
	await page.getByRole('searchbox', { name: 'Search boards' }).fill('zzz');
	await expect(page.getByRole('heading', { name: 'No boards match “zzz”' })).toBeVisible();
	await page.getByRole('button', { name: 'Clear search' }).click();
	await expect(page.locator('article')).toHaveCount(3);

	await page.getByRole('link', { name: 'All boards' }).click();
	await page.getByRole('button', { name: 'Sort boards' }).click();
	await page.getByRole('option', { name: 'Name' }).click();
	await expect(page.locator('article h3')).toHaveText(['alpha', 'Beta', 'Gamma plan']);

	await page.getByRole('button', { name: 'List view' }).click();
	await expect(page.getByRole('button', { name: 'List view' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.reload();
	await expect(page.getByRole('button', { name: 'List view' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	// Sort is remembered too.
	await expect(page.locator('article h3')).toHaveText(['alpha', 'Beta', 'Gamma plan']);
});

test('keyboard: arrows move between cards, F2 renames, Delete trashes', async ({ page }) => {
	await createBoards(page, 2);
	const links = page.locator('[data-card-link]');
	await links.first().focus();
	await page.keyboard.press('ArrowRight');
	await expect(links.nth(1)).toBeFocused();
	await expect(links.nth(0)).toHaveAttribute('tabindex', '-1');
	await expect(links.nth(1)).toHaveAttribute('tabindex', '0');

	await page.keyboard.press('F2');
	const input = page.getByRole('textbox', { name: 'Board title' });
	await input.fill('Keyboard board');
	await input.press('Enter');
	await expect(card(page, 'Keyboard board')).toBeVisible();

	await card(page, 'Keyboard board').locator('[data-card-link]').focus();
	await page.keyboard.press('Delete');
	await expect(card(page, 'Keyboard board')).toBeHidden();
	await expect(page.getByText('Moved to trash')).toBeVisible();
});

test('"/" focuses search', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'No boards yet' })).toBeVisible();
	await page.keyboard.press('/');
	await expect(page.getByRole('searchbox', { name: 'Search boards' })).toBeFocused();
});
