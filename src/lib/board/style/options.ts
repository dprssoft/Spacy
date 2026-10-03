import { jsonEqual } from '$lib/model/equal';
import type { Element, ElementType } from '$lib/model/types';

export type StyleOption =
	| 'fill'
	| 'fillStyle'
	| 'stroke'
	| 'strokeWidth'
	| 'dash'
	| 'radius'
	| 'shadow'
	| 'opacity'
	| 'fontSize'
	| 'fontFamily'
	| 'fontStyle'
	| 'textColor'
	| 'align'
	| 'valign'
	| 'shapeKind'
	| 'stickyColor'
	| 'routing' // connectors (step 21)
	| 'markers'
	| 'labelBackground';

/** Which popover controls apply to each element type. */
export const STYLE_OPTIONS: Record<ElementType, readonly StyleOption[]> = {
	shape: [
		'fill',
		'fillStyle',
		'stroke',
		'strokeWidth',
		'dash',
		'radius',
		'shadow',
		'opacity',
		'fontSize',
		'fontFamily',
		'fontStyle',
		'textColor',
		'align',
		'valign',
		'shapeKind'
	],
	sticky: [
		'stickyColor',
		'fontSize',
		'fontFamily',
		'fontStyle',
		'align',
		'valign',
		'shadow',
		'opacity'
	],
	text: ['textColor', 'fontSize', 'fontFamily', 'fontStyle', 'align', 'opacity'],
	image: ['stroke', 'strokeWidth', 'dash', 'radius', 'shadow', 'opacity'],
	stroke: ['stroke', 'strokeWidth', 'opacity'],
	sketch: ['opacity'],
	frame: ['fill', 'fillStyle', 'stroke', 'radius'],
	doccard: ['fill', 'stroke', 'radius', 'shadow', 'fontSize', 'fontFamily'],
	connector: ['stroke', 'strokeWidth', 'dash', 'opacity', 'routing', 'markers', 'labelBackground'],
	media: ['radius', 'shadow']
};

export const MIXED: unique symbol = Symbol('mixed');
export type Mixed = typeof MIXED;

/** Options shared by every given type (empty for an empty selection). */
export function optionsFor(types: Iterable<ElementType>): Set<StyleOption> {
	const lists = [...new Set(types)].map((t) => STYLE_OPTIONS[t]);
	const [first, ...rest] = lists;
	if (!first) return new Set();
	return new Set(first.filter((o) => rest.every((list) => list.includes(o))));
}

/** The value all elements share, or MIXED. */
export function commonValue<T>(els: readonly Element[], read: (el: Element) => T): T | Mixed {
	if (els.length === 0) return MIXED;
	const first = read(els[0]!);
	for (let i = 1; i < els.length; i++) if (!jsonEqual(read(els[i]!), first)) return MIXED;
	return first;
}
