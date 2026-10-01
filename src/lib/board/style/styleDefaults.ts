import { baseStyleFor } from '$lib/model/defaults';
import { styleSchema } from '$lib/model/schema';
import type { ElementType, Marker, Routing, Style } from '$lib/model/types';
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

export interface ConnectorShapeDefaults {
	routing: Routing;
	markerStart: Marker;
	markerEnd: Marker;
}

const BUILT_IN_CONNECTOR: ConnectorShapeDefaults = {
	routing: 'elbow',
	markerStart: 'none',
	markerEnd: 'arrow'
};
const ROUTINGS: readonly Routing[] = ['straight', 'elbow', 'curve'];
const MARKER_KINDS: readonly Marker[] = [
	'none',
	'arrow',
	'openArrow',
	'triangle',
	'diamond',
	'circle',
	'bar'
];

/** Routing and markers for new connectors ("Set as default" on a connector saves these too). */
export function getConnectorDefaults(): ConnectorShapeDefaults {
	const saved = getPref<Partial<ConnectorShapeDefaults> | null>('defaults:connector:shape', null);
	const pick = <T>(v: T | undefined, allowed: readonly T[], fallback: T) =>
		v !== undefined && allowed.includes(v) ? v : fallback;
	return {
		routing: pick(saved?.routing, ROUTINGS, BUILT_IN_CONNECTOR.routing),
		markerStart: pick(saved?.markerStart, MARKER_KINDS, BUILT_IN_CONNECTOR.markerStart),
		markerEnd: pick(saved?.markerEnd, MARKER_KINDS, BUILT_IN_CONNECTOR.markerEnd)
	};
}

export function setConnectorDefaults(d: ConnectorShapeDefaults): void {
	setPref('defaults:connector:shape', d);
}

export function resetConnectorDefaults(): void {
	removePref('defaults:connector:shape');
}
