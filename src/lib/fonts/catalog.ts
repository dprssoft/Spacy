// The fonts text can use: canvas text (style.font.family) and doc card text (the fontFamily mark).
// Pure data: the font files are registered by ./register.ts.
import { FONT_FAMILY } from '$lib/model/defaults';

export type FontCategory = 'Sans serif' | 'Serif' | 'Monospace' | 'Handwriting';

export interface FontDef {
	id: string;
	label: string;
	category: FontCategory;
	/** CSS font-family value, with fallbacks. */
	stack: string;
	/** The family name of the bundled files, if any (prefixed: never the user's installed copy). */
	bundled?: { family: string; weight: string };
	/** Still valid and drawn, but not offered in font pickers (shown only while it is in use). */
	hidden?: boolean;
}

const bundled = (name: string, weight: string, fallback: string) => {
	const family = `Spacy ${name}`;
	return { stack: `"${family}", ${fallback}`, bundled: { family, weight } };
};

export const DEFAULT_FONT = 'default';

export const FONTS: readonly FontDef[] = [
	{ id: DEFAULT_FONT, label: 'Default', category: 'Sans serif', stack: FONT_FAMILY },
	{
		id: 'inter',
		label: 'Inter',
		category: 'Sans serif',
		// Default is Inter too, so offering both showed the same font twice.
		hidden: true,
		...bundled('Inter', '100 900', FONT_FAMILY)
	},
	{
		id: 'montserrat',
		label: 'Montserrat',
		category: 'Sans serif',
		...bundled('Montserrat', '100 900', 'sans-serif')
	},
	{
		id: 'oswald',
		label: 'Oswald',
		category: 'Sans serif',
		...bundled('Oswald', '200 700', '"Arial Narrow", sans-serif')
	},
	{
		id: 'comfortaa',
		label: 'Comfortaa',
		category: 'Sans serif',
		...bundled('Comfortaa', '300 700', 'sans-serif')
	},
	{
		id: 'serif',
		label: 'Serif',
		category: 'Serif',
		// System fonts look different on every computer (and like a browser default where Georgia
		// isn't installed); Lora is the bundled serif.
		hidden: true,
		stack: "Georgia, Cambria, 'Times New Roman', Times, serif"
	},
	{ id: 'lora', label: 'Lora', category: 'Serif', ...bundled('Lora', '400 700', 'Georgia, serif') },
	{
		id: 'roboto-slab',
		label: 'Roboto Slab',
		category: 'Serif',
		...bundled('Roboto Slab', '100 900', 'Rockwell, Georgia, serif')
	},
	{
		id: 'playfair',
		label: 'Playfair Display',
		category: 'Serif',
		...bundled('Playfair Display', '400 900', 'Georgia, serif')
	},
	{
		id: 'mono',
		label: 'Monospace',
		category: 'Monospace',
		// Same as Serif: JetBrains Mono is the bundled monospace.
		hidden: true,
		stack: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
	},
	{
		id: 'jetbrains-mono',
		label: 'JetBrains Mono',
		category: 'Monospace',
		...bundled('JetBrains Mono', '100 800', 'ui-monospace, monospace')
	},
	{
		id: 'caveat',
		label: 'Caveat',
		category: 'Handwriting',
		...bundled('Caveat', '400 700', 'cursive')
	},
	{
		id: 'pacifico',
		label: 'Pacifico',
		category: 'Handwriting',
		...bundled('Pacifico', '400', 'cursive')
	}
];

export const FONT_CATEGORIES: readonly FontCategory[] = [
	'Sans serif',
	'Serif',
	'Monospace',
	'Handwriting'
];

/** The fonts a picker offers: every font that isn't hidden, plus `current` if it is. */
export const pickableFonts = (current?: string | null): FontDef[] =>
	FONTS.filter((f) => !f.hidden || f.id === current);

const byId = new Map(FONTS.map((f) => [f.id, f]));

/** A known font, or the default for a missing or unknown id. */
export function fontDef(id: string | null | undefined): FontDef {
	return (id && byId.get(id)) || byId.get(DEFAULT_FONT)!;
}

export const fontStack = (id: string | null | undefined): string => fontDef(id).stack;

export const isFontId = (v: unknown): v is string => typeof v === 'string' && byId.has(v);

/** Doc card rules: the `fontFamily` mark renders as `data-font`. */
export function docFontCss(): string {
	return FONTS.filter((f) => f.id !== DEFAULT_FONT)
		.map((f) => `:is(.doc-prose, .doc-format) [data-font='${f.id}'] { font-family: ${f.stack}; }`)
		.join('\n');
}
