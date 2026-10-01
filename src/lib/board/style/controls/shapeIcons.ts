import type { ShapeKind } from '$lib/model/types';
import { shapePath } from '../../elements/shape/paths';

/** A 16×16 SVG path previewing a shape kind (used in pickers). */
export function shapeIconPath(kind: ShapeKind): string {
	return shapePath(kind, 16, 12, 2, 1);
}

export { SHAPE_KINDS as BASIC_KINDS } from '../../elements/shape/paths';
