import type { Marker, Point } from '$lib/model/types';

export interface MarkerShape {
	/** Path in local coordinates: tip at (0,0), pointing toward +x. */
	d: string;
	/** Filled with the stroke color (else filled with the background and stroked). */
	filled: boolean;
	/** Stroked only (open arrow, bar). */
	open: boolean;
}

/** Marker size from the connector's stroke width. */
export const markerSize = (strokeWidth: number) => 8 + strokeWidth * 2.5;

export function markerShape(kind: Marker, size: number): MarkerShape | null {
	const s = size;
	const h = s * 0.45;
	switch (kind) {
		case 'none':
			return null;
		case 'arrow':
			return { d: `M0,0 L${-s},${-h} L${-s * 0.75},0 L${-s},${h} Z`, filled: true, open: false };
		case 'openArrow':
			return { d: `M${-s},${-h} L0,0 L${-s},${h}`, filled: false, open: true };
		case 'triangle':
			return { d: `M0,0 L${-s},${-h} L${-s},${h} Z`, filled: false, open: false };
		case 'diamond':
			return { d: `M0,0 L${-s / 2},${-h} L${-s},0 L${-s / 2},${h} Z`, filled: false, open: false };
		case 'circle': {
			const r = s * 0.32;
			return {
				d: `M0,0 A${r},${r} 0 1,1 ${-2 * r},0 A${r},${r} 0 1,1 0,0 Z`,
				filled: true,
				open: false
			};
		}
		case 'bar':
			return { d: `M0,${-h} L0,${h}`, filled: false, open: true };
	}
}

export const MARKERS: { value: Marker; label: string }[] = [
	{ value: 'none', label: 'None' },
	{ value: 'arrow', label: 'Arrow' },
	{ value: 'openArrow', label: 'Open arrow' },
	{ value: 'triangle', label: 'Triangle' },
	{ value: 'diamond', label: 'Diamond' },
	{ value: 'circle', label: 'Circle' },
	{ value: 'bar', label: 'Bar' }
];

/** SVG transform placing a marker at `tip`, pointing along `angle`. */
export function markerTransform(tip: Point, angle: number): string {
	return `translate(${tip.x} ${tip.y}) rotate(${(angle * 180) / Math.PI})`;
}
