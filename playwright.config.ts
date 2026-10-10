import { defineConfig, devices } from '@playwright/test';

/** The live sharing relay for e2e (y-webrtc's Node relay, `pnpm relay`). */
const RELAY = 'ws://localhost:4444';

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 2 : undefined,
	reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'on-first-retry'
	},
	webServer: [
		{
			// The production output, served like a static host with the real security headers (CSP).
			// Live sharing goes through the local relay below.
			command: `PUBLIC_SIGNALING_URLS=${RELAY} pnpm build && node scripts/serve-build.mjs 4173`,
			port: 4173,
			reuseExistingServer: !process.env.CI
		},
		{ command: 'pnpm relay', port: 4444, reuseExistingServer: !process.env.CI }
	],
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile-.*\.spec\.ts/ },
		{ name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: /mobile-.*\.spec\.ts/ },
		{ name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: /mobile-.*\.spec\.ts/ },
		// Phones: Chromium with touch input (Pixel 7 emulation).
		{ name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile-.*\.spec\.ts/ }
	]
});
