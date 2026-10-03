import { docFontCss, fontDef, FONTS } from './catalog';
import { FONT_FILES, UNICODE_RANGES, type Subset } from './files';

let registered = false;

/**
 * Makes the bundled fonts available to the page. Nothing is downloaded here: the browser fetches
 * a font file the first time text needs it. Safe to call more than once.
 */
export function registerFonts(): void {
	if (registered || typeof document === 'undefined' || typeof FontFace === 'undefined') return;
	registered = true;
	for (const font of FONTS) {
		const files = FONT_FILES[font.id];
		if (!font.bundled || !files) continue;
		for (const subset of Object.keys(files) as Subset[]) {
			const face = new FontFace(font.bundled.family, `url(${files[subset]}) format('woff2')`, {
				weight: font.bundled.weight,
				unicodeRange: UNICODE_RANGES[subset],
				display: 'swap'
			});
			document.fonts.add(face);
		}
	}
	const sheet = new CSSStyleSheet();
	sheet.replaceSync(docFontCss());
	document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}

/** Waits until the given fonts can draw `text` (for measuring and exporting); never throws. */
export async function loadFonts(ids: Iterable<string>, text = 'AaЯя'): Promise<void> {
	const families = new Set<string>();
	for (const id of ids) {
		const family = fontDef(id).bundled?.family;
		if (family) families.add(family);
	}
	await Promise.all(
		[...families].map((f) => document.fonts.load(`16px "${f}"`, text).catch(() => []))
	);
}
