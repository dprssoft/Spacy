// Text formatting choices of doc cards. Content stores these ids (as `data-*` attributes, styled in
// prose.css, so they can follow the theme) or, for colors, a `#rrggbb` value. Nothing else reaches
// CSS.
import { DEFAULT_FONT, FONTS as ALL_FONTS, pickableFonts } from '$lib/fonts/catalog';

export interface FormatChoice {
	id: string;
	label: string;
}

export const TEXT_COLORS: readonly FormatChoice[] = [
	{ id: 'gray', label: 'Gray' },
	{ id: 'red', label: 'Red' },
	{ id: 'orange', label: 'Orange' },
	{ id: 'green', label: 'Green' },
	{ id: 'teal', label: 'Teal' },
	{ id: 'blue', label: 'Blue' },
	{ id: 'violet', label: 'Violet' },
	{ id: 'pink', label: 'Pink' }
];

export const HIGHLIGHTS: readonly FormatChoice[] = [
	{ id: 'yellow', label: 'Yellow' },
	{ id: 'orange', label: 'Orange' },
	{ id: 'green', label: 'Green' },
	{ id: 'teal', label: 'Teal' },
	{ id: 'blue', label: 'Blue' },
	{ id: 'violet', label: 'Violet' },
	{ id: 'pink', label: 'Pink' }
];

/** Besides the default font (the card's own). */
export const FONTS: readonly FormatChoice[] = ALL_FONTS.filter((f) => f.id !== DEFAULT_FONT).map(
	({ id, label }) => ({ id, label })
);

/** The fonts the font menu offers (hidden ones only while the selection uses them). */
export const pickableFontChoices = (current: string | null): FormatChoice[] =>
	pickableFonts(current)
		.filter((f) => f.id !== DEFAULT_FONT)
		.map(({ id, label }) => ({ id, label }));

/** Besides the default size. Relative to the card's own font size. */
export const SIZES: readonly FormatChoice[] = [
	{ id: 'small', label: 'Small' },
	{ id: 'large', label: 'Large' },
	{ id: 'huge', label: 'Huge' }
];

export const ALIGNS = ['left', 'center', 'right', 'justify'] as const;
export type Align = (typeof ALIGNS)[number];

interface FormatMarkDef {
	attr: string;
	/** The DOM attribute that carries the id (`custom` for a color value). */
	data: string;
	choices: readonly FormatChoice[];
	/** Colors: the CSS variable that carries a `#rrggbb` value. */
	custom?: string;
}

/** One mark per property. */
export const FORMAT_MARKS = {
	textColor: { attr: 'color', data: 'data-color', choices: TEXT_COLORS, custom: '--doc-color' },
	highlight: {
		attr: 'color',
		data: 'data-highlight',
		choices: HIGHLIGHTS,
		custom: '--doc-highlight'
	},
	fontFamily: { attr: 'font', data: 'data-font', choices: FONTS },
	fontSize: { attr: 'size', data: 'data-size', choices: SIZES }
} as const satisfies Record<string, FormatMarkDef>;
export type FormatMark = keyof typeof FORMAT_MARKS;

export const CUSTOM = 'custom';
export const isHexColor = (v: unknown): v is string =>
	typeof v === 'string' && /^#[0-9a-f]{6}$/.test(v);

const markDef = (mark: FormatMark): FormatMarkDef => FORMAT_MARKS[mark];

/** An id from the mark's list, or a `#rrggbb` color for the color marks. */
export const isChoice = (mark: FormatMark, value: unknown): value is string =>
	typeof value === 'string' &&
	(markDef(mark).choices.some((c) => c.id === value) ||
		(!!markDef(mark).custom && isHexColor(value)));

/** The CSS variable for a mark's `#rrggbb` value, if it takes one. */
export const customVar = (mark: FormatMark): string | undefined => markDef(mark).custom;

export const BLOCK_STYLES = [
	{ id: 'p', label: 'Normal text' },
	{ id: 'h1', label: 'Heading 1' },
	{ id: 'h2', label: 'Heading 2' },
	{ id: 'h3', label: 'Heading 3' },
	{ id: 'quote', label: 'Quote' },
	{ id: 'code', label: 'Code block' }
] as const;
export type BlockStyle = (typeof BLOCK_STYLES)[number]['id'];
