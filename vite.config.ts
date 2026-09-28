/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// SPA mode: every route falls back to index.html (see plan/00-architecture.md §2).
			adapter: adapter({ fallback: 'index.html' })
		})
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
