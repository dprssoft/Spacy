/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, loadEnv } from 'vite';
import pkg from './package.json' with { type: 'json' };

// The SPA fallback for client-only routes; index.html is the prerendered start page.
const FALLBACK = '200.html';
const BUILD_ID = `${pkg.version}-${Date.now().toString(36)}`;
// PUBLIC_* settings from the environment, or from .env / .env.local (the environment wins). Unit
// tests ignore the files, so a developer's local settings don't change what they test.
const env = {
	...(process.env.VITEST
		? {}
		: loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), 'PUBLIC_')),
	...process.env
};

// A project site on GitHub Pages lives under /<repo>: build with BASE_PATH=/<repo> (README → Deploy).
const BASE = (process.env.BASE_PATH ?? '') as '' | `/${string}`;

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version),
		// Live sharing through a WebSocket relay instead of public Nostr relays (tests, private networks).
		__LIVE_RELAY_URLS__: JSON.stringify(env.PUBLIC_LIVE_RELAY_URLS ?? ''),
		// Google Drive sync (plan/steps/50); unset hides it.
		__GOOGLE_CLIENT_ID__: JSON.stringify(env.PUBLIC_GOOGLE_CLIENT_ID ?? '')
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// SPA mode: routes fall back to 200.html; `/` is prerendered (see plan/00-architecture.md §2).
			adapter: adapter({ fallback: FALLBACK }),
			// Absolute asset URLs: the service worker serves the same page for every route when offline.
			paths: { relative: false, base: BASE }
		}),
		SvelteKitPWA({
			// 'prompt': a new version waits until the user reloads (never mid-edit).
			registerType: 'prompt',
			kit: {
				adapterFallback: FALLBACK,
				base: `${BASE}/`,
				// The fallback page changes with every build (it references hashed assets). The
				// prerendered start page is precached as '/' by the plugin.
				spa: { fallbackMapping: `${BASE}/200.html`, fallbackRevision: async () => BUILD_ID }
			},
			manifest: {
				name: 'Spacy',
				short_name: 'Spacy',
				description: 'A whiteboard with diagrams and docs that lives in your browser.',
				start_url: `${BASE}/`,
				scope: `${BASE}/`,
				display: 'standalone',
				theme_color: '#4f46e5',
				background_color: '#f7f7f8',
				icons: [
					{ src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
					{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
					{ src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
					{
						src: 'maskable-icon-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				],
				file_handlers: [
					{ action: `${BASE}/`, accept: { 'application/x-spacy': ['.spacy', '.smthng'] } }
				]
			},
			workbox: {
				// Everything the client needs, so any route (the SPA fallback) works offline.
				globPatterns: [
					'client/**/*.{js,css,html,svg,png,ico,webp,woff2,webmanifest}',
					'prerendered/**/*.{html,json}'
				],
				// The start page's data (__data.json) is fetched with SvelteKit's own query parameters.
				ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^x-sveltekit-/],
				navigateFallback: `${BASE}/200.html`
			}
		}),
		// `pnpm analyze` writes stats.html (a treemap of the client bundle).
		...(process.env.ANALYZE
			? [visualizer({ filename: 'stats.html', gzipSize: true, template: 'treemap' })]
			: [])
	],
	// Svelte resolves its server build under Node unless told otherwise; component tests need the browser build.
	resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
	test: {
		environment: 'jsdom',
		include: ['src/**/*.{test,spec}.{ts,js}'],
		setupFiles: ['./vitest.setup.ts'],
		coverage: {
			include: ['src/lib/**/*.ts'],
			exclude: ['**/*.test.ts', '**/testFixtures.ts', '**/*.d.ts']
		}
	}
});
