// Text formatting choices of doc cards. Content stores only these ids (as `data-*` attributes);
// their appearance is in prose.css, so it can follow the theme and nothing unchecked reaches CSS.

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

/** Besides the default (the app's sans-serif). System font stacks: nothing is downloaded. */
export const FONTS: readonly FormatChoice[] = [
	{ id: 'serif', label: 'Serif' },
	{ id: 'mono', label: 'Monospace' }
];

/** Besides the default size. Relative to the card's own font size. */
export const SIZES: readonly FormatChoice[] = [
	{ id: 'small', label: 'Small' },
	{ id: 'large', label: 'Large' },
	{ id: 'huge', label: 'Huge' }
];

export const ALIGNS = ['left', 'center', 'right', 'justify'] as const;
export type Align = (typeof ALIGNS)[number];

/** One mark per property: its name, its attribute and the DOM attribute that carries the id. */
export const FORMAT_MARKS = {
	textColor: { attr: 'color', data: 'data-color', choices: TEXT_COLORS },
	highlight: { attr: 'color', data: 'data-highlight', choices: HIGHLIGHTS },
	fontFamily: { attr: 'font', data: 'data-font', choices: FONTS },
	fontSize: { attr: 'size', data: 'data-size', choices: SIZES }
} as const;
export type FormatMark = keyof typeof FORMAT_MARKS;

export const isChoice = (mark: FormatMark, value: unknown): value is string =>
	typeof value === 'string' && FORMAT_MARKS[mark].choices.some((c) => c.id === value);

export const BLOCK_STYLES = [
	{ id: 'p', label: 'Normal text' },
	{ id: 'h1', label: 'Heading 1' },
	{ id: 'h2', label: 'Heading 2' },
	{ id: 'h3', label: 'Heading 3' },
	{ id: 'quote', label: 'Quote' },
	{ id: 'code', label: 'Code block' }
] as const;
export type BlockStyle = (typeof BLOCK_STYLES)[number]['id'];
