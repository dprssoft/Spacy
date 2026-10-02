import { expect, test } from '@playwright/test';
import { createBoard, el, enableTestHooks, waitForHooks } from './helpers';

test('two tabs on the same board see each other’s creates, moves and typing', async ({
	page,
	context
}) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	const other = await context.newPage();
	await other.goto(page.url());
	await other.waitForFunction(() => !!window.__smthng);

	// Create in the first tab.
	await page.evaluate(
		(e) => window.__smthng!.createElements([e as never]),
		el.shape('a', -80, -50, { text: 'Shared' })
	);
	const remote = other.locator('[data-element-id="a"]');
	await expect(remote).toHaveText('Shared');

	// Move it in the first tab: the second follows.
	const before = (await remote.boundingBox())!;
	const box = (await page.locator('[data-element-id="a"]').boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 80, { steps: 6 });
	await page.mouse.up();
	await expect.poll(async () => Math.round((await remote.boundingBox())!.x - before.x)).toBe(120);

	// Type in the second tab: the first sees the text.
	await other.mouse.dblclick(before.x + 120 + before.width / 2, before.y + 80 + before.height / 2);
	const editor = other.getByRole('textbox', { name: 'Edit text' });
	await expect(editor).toBeFocused();
	await editor.fill('Edited elsewhere');
	await other.keyboard.press('Escape');
	await expect(page.locator('[data-element-id="a"]')).toHaveText('Edited elsewhere');

	// Remote changes aren't on this tab's undo stack.
	await page.getByTestId('canvas').focus();
	await page.keyboard.press('ControlOrMeta+z'); // undoes this tab's own move only
	await expect(page.locator('[data-element-id="a"]')).toHaveText('Edited elsewhere');
	await expect.poll(async () => Math.round((await remote.boundingBox())!.x - before.x)).toBe(0);
});
