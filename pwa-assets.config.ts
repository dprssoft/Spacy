import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// `pnpm icons` regenerates the PWA icons in static/ from static/logo.svg.
const background = '#4f46e5';

export default defineConfig({
	preset: {
		...minimal2023Preset,
		// Full-bleed tiles: the OS applies its own mask, so fill the margin with the logo's color.
		maskable: { ...minimal2023Preset.maskable, resizeOptions: { background } },
		apple: { ...minimal2023Preset.apple, resizeOptions: { background } }
	},
	images: ['static/logo.svg']
});
