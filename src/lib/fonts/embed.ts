import { fontDef } from './catalog';
import { FONT_FILES, UNICODE_RANGES, type Subset } from './files';

async function dataUrl(url: string): Promise<string | null> {
	try {
		const blob = await (await fetch(url)).blob();
		return await new Promise((resolve) => {
			const r = new FileReader();
			r.onload = () => resolve(typeof r.result === 'string' ? r.result : null);
			r.onerror = () => resolve(null);
			r.readAsDataURL(blob);
		});
	} catch {
		return null;
	}
}

/**
 * `@font-face` rules with the files of the given bundled fonts inlined, for an exported SVG (which
 * can't reach the app's files). Fonts that can't be read are left out: the text falls back.
 */
export async function embeddedFontCss(ids: Iterable<string>): Promise<string> {
	const rules: Promise<string | null>[] = [];
	for (const id of new Set(ids)) {
		const font = fontDef(id);
		const files = FONT_FILES[font.id];
		if (!font.bundled || !files) continue;
		const { family, weight } = font.bundled;
		for (const subset of Object.keys(files) as Subset[])
			rules.push(
				dataUrl(files[subset]).then((src) =>
					src
						? `@font-face{font-family:"${family}";src:url(${src}) format("woff2");font-weight:${weight};unicode-range:${UNICODE_RANGES[subset]}}`
						: null
				)
			);
	}
	return (await Promise.all(rules)).filter((r): r is string => r !== null).join('');
}
