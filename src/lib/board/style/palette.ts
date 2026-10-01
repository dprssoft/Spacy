import { PALETTE, STICKY_COLORS } from '$lib/model/defaults';

const NAMES = [
	'Black',
	'Gray',
	'Red',
	'Orange',
	'Yellow',
	'Green',
	'Teal',
	'Blue',
	'Violet',
	'Pink',
	'White',
	'Transparent'
];

export const PALETTE_SWATCHES = PALETTE.map((value, i) => ({ value, name: NAMES[i] ?? value }));
export const OPAQUE_SWATCHES = PALETTE_SWATCHES.filter((c) => c.value !== 'transparent');

export const STICKY_SWATCHES = Object.entries(STICKY_COLORS).map(([name, value]) => ({
	value,
	name: name[0]!.toUpperCase() + name.slice(1)
}));
