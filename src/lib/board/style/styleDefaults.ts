import { baseStyleFor } from '$lib/model/defaults';
import { styleSchema } from '$lib/model/schema';
import type { ElementType, Style } from '$lib/model/types';
import { getPref, removePref, setPref } from '$lib/shared/localPrefs';
import { mergeStyle, type StylePatch } from './applyStyle';

const key = (type: ElementType) => `defaults:${type}`;

/** Style for new elements of `type`: the built-in style with the user's saved default on top. */
export function getDefaultStyle(type: ElementType): Style {
	const base = baseStyleFor(type);
	const saved = getPref<StylePatch | null>(key(type), null);
	if (!saved || typeof saved !== 'object') return base;
	const merged = styleSchema.safeParse(mergeStyle(base, saved));
	return merged.success ? merged.data : base;
}

export function setDefaultStyle(type: ElementType, style: Style): void {
	setPref(key(type), style);
}

export function resetDefaultStyle(type: ElementType): void {
	removePref(key(type));
}

export function hasCustomDefault(type: ElementType): boolean {
	return getPref<unknown>(key(type), null) !== null;
}
