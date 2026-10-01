import { expect, test, type Page } from '@playwright/test';
import { createBoard, el, enableTestHooks, waitForHooks } from './helpers';

async function openMenu(page: Page, title: string) {
	const card = page.locator('article', { has: page.getByText(title, { exact: true }) });
	await card.hover();
	await card.getByRole('button', { name: 'Board actions' }).click();
}

test('export a board, delete it forever, import it back', async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await page.getByRole('button', { name: /Rename board/ }).click();
	await page.getByRole('textbox', { name: 'Board title' }).fill('Launch');
	await page.keyboard.press('Enter');
	await page.evaluate((e) => window.__smthng!.createElements([e as never]), {
		...el.shape('n', -100, -100),
		type: 'sticky',
		kind: undefined,
		text: 'Exported',
		color: '#ffe066',
		w: 200,
		h: 200
	});
	await page.goto('/');

	await openMenu(page, 'Launch');
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('menuitem', { name: 'Export' }).click()
	]);
	expect(download.suggestedFilename()).toBe('launch.smthng');
	const path = (await download.path())!;

	await openMenu(page, 'Launch');
	await page.getByRole('menuitem', { name: 'Move to trash' }).click();
	await page.getByRole('link', { name: 'Trash' }).click();
	await openMenu(page, 'Launch');
	await page.getByRole('menuitem', { name: 'Delete forever' }).click();
	await page.getByRole('button', { name: 'Delete forever' }).click();
	await expect(page.getByRole('heading', { name: 'Trash is empty' })).toBeVisible();

	await page.getByRole('link', { name: 'All boards' }).click();
	await page.getByTestId('import-input').setInputFiles(path);
	await expect(page.getByText('Imported “Launch”')).toBeVisible();
	const card = page.locator('article', { has: page.getByText('Launch', { exact: true }) });
	await expect(card).toHaveCount(1);
	await card.getByRole('link').first().click();
	await expect(page.locator('[data-type="sticky"]')).toHaveText('Exported');
});

test('importing twice creates two boards; bad files are reported', async ({ page }) => {
	await page.goto('/');
	const file = {
		name: 'one.smthng',
		mimeType: 'application/json',
		buffer: Buffer.from(
			JSON.stringify({
				format: 'smthng',
				version: 1,
				kind: 'board',
				exportedAt: 0,
				board: { title: 'Twice', createdAt: 0, doc: 'AAA=', assets: [] } // an empty Y.Doc
			})
		)
	};
	await page.getByTestId('import-input').setInputFiles(file);
	await expect(page.getByText('Imported “Twice”')).toBeVisible();
	await page.getByTestId('import-input').setInputFiles({ ...file, name: 'two.smthng' });
	await page.getByRole('link', { name: 'All boards' }).click();
	await expect(
		page.locator('article', { has: page.getByText('Twice', { exact: true }) })
	).toHaveCount(2);

	await page.getByTestId('import-input').setInputFiles({
		name: 'bad.smthng',
		mimeType: 'application/json',
		buffer: Buffer.from('{"format":"other"}')
	});
	await expect(
		page.getByText('Couldn’t import bad.smthng: the file is not a SMTHNG file')
	).toBeVisible();
});

test('the board Export menu downloads a .smthng file', async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await page.getByRole('button', { name: 'Export' }).click();
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('menuitem', { name: 'Download .smthng' }).click()
	]);
	expect(download.suggestedFilename()).toBe('untitled-board.smthng');
});
