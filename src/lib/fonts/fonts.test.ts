import { describe, expect, it } from 'vitest';
import { FONT_FAMILY } from '$lib/model/defaults';
import {
	DEFAULT_FONT,
	docFontCss,
	fontDef,
	FONTS,
	fontStack,
	isFontId,
	pickableFonts
} from './catalog';
import { FONT_FILES, UNICODE_RANGES } from './files';

describe('font catalog', () => {
	it('has unique ids and a file per subset for every bundled font', () => {
		expect(new Set(FONTS.map((f) => f.id)).size).toBe(FONTS.length);
		for (const f of FONTS) {
			if (!f.bundled) continue;
			expect(f.stack.startsWith(`"${f.bundled.family}"`)).toBe(true);
			for (const subset of Object.keys(UNICODE_RANGES))
				expect(
					FONT_FILES[f.id]?.[subset as keyof typeof UNICODE_RANGES],
					`${f.id} ${subset}`
				).toMatch(/\.woff2/);
		}
		expect(FONTS.filter((f) => f.bundled)).toHaveLength(10);
	});

	it('falls back to the default font for missing or unknown ids', () => {
		expect(fontStack(undefined)).toBe(FONT_FAMILY);
		expect(fontStack('nope')).toBe(FONT_FAMILY);
		expect(fontDef('lora').label).toBe('Lora');
		expect(isFontId('caveat')).toBe(true);
		expect(isFontId('Comic Sans')).toBe(false);
	});

	it('writes a doc card rule for every font but the default', () => {
		const css = docFontCss();
		for (const f of FONTS)
			if (f.id === DEFAULT_FONT) expect(css).not.toContain(`'${f.id}'`);
			else expect(css).toContain(`[data-font='${f.id}'] { font-family: ${f.stack}; }`);
	});

	it('pickers offer no font twice: Inter stays valid but only shows while in use', () => {
		const ids = pickableFonts().map((f) => f.id);
		expect(ids).not.toContain('inter');
		expect(new Set(pickableFonts().map((f) => f.label)).size).toBe(ids.length);
		expect(pickableFonts('inter').map((f) => f.id)).toContain('inter');
		expect(isFontId('inter')).toBe(true);
		expect(fontStack('inter')).toContain('"Spacy Inter"');
	});
});
