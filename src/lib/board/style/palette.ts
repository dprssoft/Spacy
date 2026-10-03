import { STICKY_COLORS } from '$lib/model/defaults';

export interface Swatch {
	value: string;
	name: string;
}

// Shades of each hue (open-color 2, 4, 8 and 9). The third shade is the original palette, so its
// colors keep their plain names ("Red").
const HUES: [string, string, string, string, string][] = [
	['Red', '#ffc9c9', '#ff8787', '#e03131', '#c92a2a'],
	['Orange', '#ffd8a8', '#ffa94d', '#f76707', '#d9480f'],
	['Yellow', '#ffec99', '#ffd43b', '#f59f00', '#e67700'],
	['Lime', '#d8f5a2', '#a9e34b', '#66a80f', '#5c940d'],
	['Green', '#b2f2bb', '#69db7c', '#2f9e44', '#2b8a3e'],
	['Teal', '#99e9f2', '#3bc9db', '#0c8599', '#0b7285'],
	['Blue', '#a5d8ff', '#4dabf7', '#1971c2', '#1864ab'],
	['Indigo', '#bac8ff', '#748ffc', '#3b5bdb', '#364fc7'],
	['Violet', '#d0bfff', '#9775fa', '#6741d9', '#5f3dc4'],
	['Pink', '#fcc2d7', '#f783ac', '#c2255c', '#a61e4d']
];
const SHADE_NAMES = ['Pale', 'Light', '', 'Dark'];

// Nine grays; the grids add a tenth (transparent, or pure black) to fill the row.
const NEUTRALS: Swatch[] = [
	{ value: '#ffffff', name: 'White' },
	{ value: '#f1f3f5', name: 'Pale gray' },
	{ value: '#dee2e6', name: 'Light gray' },
	{ value: '#ced4da', name: 'Silver' },
	{ value: '#adb5bd', name: 'Ash' },
	{ value: '#868e96', name: 'Gray' },
	{ value: '#495057', name: 'Dark gray' },
	{ value: '#343a40', name: 'Charcoal' },
	{ value: '#1e1e1e', name: 'Black' }
];

/** One row per shade, one column per hue. */
const SHADES: Swatch[] = SHADE_NAMES.flatMap((shade, i) =>
	HUES.map(([hue, ...values]) => ({
		value: values[i]!,
		name: shade ? `${shade} ${hue.toLowerCase()}` : hue
	}))
);

/** Columns of the color grids. */
export const PALETTE_COLUMNS = HUES.length;

/** Every color with "no color" (fills): neutrals first, then the shades. */
export const PALETTE_SWATCHES: Swatch[] = [
	...NEUTRALS,
	{ value: 'transparent', name: 'Transparent' },
	...SHADES
];
export const OPAQUE_SWATCHES: Swatch[] = [
	...NEUTRALS,
	{ value: '#000000', name: 'Pure black' },
	...SHADES
];

const STICKY_NAMES = new Map<string, string>(
	Object.entries(STICKY_COLORS).map(([name, value]) => [value, name])
);
const title = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** Paper colors: open-color 1 and 2/3 of each hue (the original sticky colors among them). */
export const STICKY_SWATCHES: Swatch[] = [
	...[
		['Red', '#ffe3e3'],
		['Orange', '#ffe8cc'],
		['Yellow', '#fff3bf'],
		['Lime', '#e9fac8'],
		['Green', '#d3f9d8'],
		['Teal', '#c5f6fa'],
		['Blue', '#d0ebff'],
		['Indigo', '#dbe4ff'],
		['Violet', '#e5dbff'],
		['Pink', '#ffdeeb']
	].map(([hue, value]) => ({ value: value!, name: `Pale ${hue!.toLowerCase()}` })),
	...[
		['Red', '#ffc9c9'],
		['Orange', STICKY_COLORS.orange],
		['Yellow', STICKY_COLORS.yellow],
		['Lime', '#d8f5a2'],
		['Green', STICKY_COLORS.green],
		['Teal', '#99e9f2'],
		['Blue', STICKY_COLORS.blue],
		['Indigo', '#bac8ff'],
		['Violet', STICKY_COLORS.violet],
		['Pink', STICKY_COLORS.pink]
	].map(([hue, value]) => ({ value: value!, name: title(STICKY_NAMES.get(value!) ?? hue!) })),
	{ value: '#ffffff', name: 'White' },
	{ value: '#f1f3f5', name: 'Pale gray' },
	{ value: '#dee2e6', name: 'Light gray' }
];

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** `#rrggbb` (lower case) for a hex color typed with or without `#`, 3 or 6 digits; else null. */
export function normalizeHex(input: string): string | null {
	const m = HEX.exec(input.trim());
	if (!m) return null;
	const digits = m[1]!.toLowerCase();
	return `#${digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits}`;
}
