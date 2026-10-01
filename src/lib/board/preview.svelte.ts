import { SvelteSet } from 'svelte/reactivity';
import type { Point, StrokeWidth } from '$lib/model/types';
import type { Guide } from './engine/snapping';

/** Transient, local-only feedback drawn by tools (never stored in the document). */
export class PreviewState {
	/** The stroke being drawn: flat [x, y, pressure, …] in world coordinates. */
	stroke = $state<{ points: number[]; width: StrokeWidth; color: string } | null>(null);
	/** Elements the eraser will delete on release. */
	readonly erasing = new SvelteSet<string>();
	/** Recent eraser positions (screen), for the trail. */
	eraserTrail = $state<Point[]>([]);
	/** Snap guides (world coordinates) shown while dragging. */
	guides = $state<Guide[]>([]);
}
