import type * as Y from 'yjs';
import { DEFAULT_STYLE } from '$lib/model/defaults';
import { getMeta } from '$lib/model/doc';
import { setMeta } from '$lib/model/ops';
import { styleSchema } from '$lib/model/schema';
import type { Style } from '$lib/model/types';
import type { StylePatch } from './applyStyle';
import { pickStyle } from './pickStyle';
import type { StyleOption } from './options';

export const PRESET_COUNT = 8;

const preset = (name: string, s: Partial<Omit<Style, 'font'>> & { text?: string }) => ({
	name,
	style: {
		...DEFAULT_STYLE,
		...s,
		font: { ...DEFAULT_STYLE.font, color: s.text ?? DEFAULT_STYLE.font.color }
	} as Style
});

export const DEFAULT_PRESETS: { name: string; style: Style }[] = [
	preset('Neutral', { fill: '#ffffff', stroke: '#1e1e1e' }),
	preset('Blue', { fill: '#a5d8ff', stroke: '#1971c2' }),
	preset('Green', { fill: '#b2f2bb', stroke: '#2f9e44' }),
	preset('Yellow', { fill: '#ffec99', stroke: '#f59f00' }),
	preset('Red', { fill: '#ffc9c9', stroke: '#e03131' }),
	preset('Violet', { fill: '#d0bfff', stroke: '#6741d9' }),
	preset('Dark', { fill: '#1e1e1e', stroke: '#1e1e1e', text: '#ffffff' }),
	preset('Outline', { fill: 'transparent', fillStyle: 'none', stroke: '#1e1e1e', dash: 'dashed' })
];

/** The board's presets (`meta.stylePresets`), falling back to the defaults for missing/invalid ones. */
export function getPresets(doc: Y.Doc): Style[] {
	const stored = getMeta(doc).get('stylePresets');
	const list = Array.isArray(stored) ? stored : [];
	return DEFAULT_PRESETS.map((d, i) => {
		const parsed = styleSchema.safeParse(list[i]);
		return parsed.success ? parsed.data : d.style;
	});
}

/** Replaces preset `index` for this board (shared by everyone who opens it). */
export function updatePreset(doc: Y.Doc, index: number, style: Style): void {
	const next = getPresets(doc);
	next[index] = structuredClone(style);
	setMeta(doc, 'stylePresets', next);
}

/** What a preset changes on elements with the given options: colors and line style only. */
export function presetPatch(style: Style, options: ReadonlySet<StyleOption>): StylePatch {
	const keep = new Set<StyleOption>(['fill', 'fillStyle', 'stroke', 'dash', 'textColor']);
	return pickStyle(style, new Set([...options].filter((o) => keep.has(o))));
}
