// Sample elements for registry-wide tests. Not imported by app code.
import { samples } from '$lib/model/testFixtures';
import type { Element, ElementType, ShapeKind } from '$lib/model/types';

const KINDS: ShapeKind[] = [
	'rect',
	'ellipse',
	'diamond',
	'process',
	'decision',
	'terminator',
	'data',
	'document',
	'database',
	'cloud',
	'actor'
];

/** A sizeable, valid element of `type` (several variants for shapes: one per kind). */
export function sampleElements(type: ElementType): Element[] {
	const base = { x: 100, y: 60, w: 160, h: 100 };
	if (type === 'shape')
		return KINDS.map((kind) => ({ ...samples.shape(`shape-${kind}`), ...base, kind }));
	if (type === 'stroke') {
		return [{ ...samples.stroke(), ...base, points: [0, 0, 0.5, 160, 100, 0.5, 80, 20, 0.5] }];
	}
	return [{ ...samples[type](), ...base } as Element];
}
