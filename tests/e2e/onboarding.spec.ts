import { expect, test } from '@playwright/test';
import { createBoard } from './helpers';

test('first-run tips show once, and again from the help menu', async ({ page }) => {
	await createBoard(page, { tips: true });
	const tip = page.getByTestId('onboarding-tip');
	await expect(tip).toContainText('Tip 1 of 3');
	await expect(tip).toContainText('Pick a tool');
	await tip.getByRole('button', { name: 'Next' }).click();
	await expect(tip).toContainText('onto any other object to connect them');
	await tip.getByRole('button', { name: 'Next' }).click();
	await expect(tip).toContainText('Press N for a doc card');
	await tip.getByRole('button', { name: 'Got it' }).click();
	await expect(tip).toBeHidden();

	await page.reload();
	await expect(page.getByTestId('canvas')).toBeVisible();
	await expect(tip).toBeHidden();

	await page.getByRole('button', { name: 'Help' }).click();
	await page.getByRole('menuitem', { name: 'Show tips again' }).click();
	await expect(tip).toContainText('Tip 1 of 3');
	await tip.getByRole('button', { name: 'Skip' }).click();
	await expect(tip).toBeHidden();

	await page.getByRole('button', { name: 'Help' }).click();
	await page.getByRole('menuitem', { name: 'About' }).click();
	await expect(page.getByRole('dialog', { name: 'Spacy' })).toContainText('Version');
});
