// UI palettes (colors in app.css under `[data-palette]`). Element colors on the board don't change.
export type PaletteId = 'default' | 'terracotta' | 'graphite' | 'petrol' | 'plum' | 'moss';

export interface Palette {
	id: PaletteId;
	label: string;
	/** Accent swatches for the picker (light, dark); also the browser's theme color. */
	accent: { light: string; dark: string };
}

export const PALETTES: readonly Palette[] = [
	{ id: 'default', label: 'Indigo', accent: { light: '#4f46e5', dark: '#818cf8' } },
	{ id: 'terracotta', label: 'Terracotta', accent: { light: '#b5471b', dark: '#ee8a5e' } },
	{ id: 'graphite', label: 'Graphite & lime', accent: { light: '#4d7c0f', dark: '#b5e550' } },
	{ id: 'petrol', label: 'Blueprint petrol', accent: { light: '#0e6b78', dark: '#5cc3cf' } },
	{ id: 'plum', label: 'Ink & plum', accent: { light: '#7a2e62', dark: '#d98cc0' } },
	{ id: 'moss', label: 'Moss & brass', accent: { light: '#3d6b4f', dark: '#8cc29f' } }
];

export const isPaletteId = (v: unknown): v is PaletteId => PALETTES.some((p) => p.id === v);
