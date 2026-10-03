import { expect, test } from '@playwright/test';

test('the app runs under its Content-Security-Policy without violations', async ({ page }) => {
	const problems: string[] = [];
	await page.addInitScript(() => {
		document.addEventListener('securitypolicyviolation', (e) =>
			console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`)
		);
	});
	page.on('console', (m) => {
		if (m.type() === 'error') problems.push(m.text());
	});
	page.on('pageerror', (e) => problems.push(e.message));

	const res = await page.goto('/');
	const csp = res!.headers()['content-security-policy'] ?? '';
	expect(csp).toContain("default-src 'self'");
	expect(csp).toMatch(/script-src 'self' 'sha256-[^']+'/);
	expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
	expect(res!.headers()['x-content-type-options']).toBe('nosniff');

	// Exercise the heavy paths: template previews (SVG data URLs), a doc card editor (injected
	// styles), the export preview (blob URLs) and the service worker.
	await expect(page.locator('[data-template] img')).toHaveCount(4); // the featured templates
	await page.getByRole('button', { name: 'Meeting notes template' }).click();
	await page.waitForURL(/\/board\//);
	await expect(page.locator('[data-doccard-body] h1')).toHaveText('Meeting notes');
	await page.getByRole('button', { name: 'Export' }).click();
	await page.getByRole('menuitem', { name: 'PNG…' }).click();
	await expect(page.getByRole('img', { name: 'Export preview' })).toBeVisible();
	await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));

	expect(problems).toEqual([]);
});
