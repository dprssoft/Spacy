import { SvelteSet } from 'svelte/reactivity';
import type { ConnectorElement, Point, StrokeWidth } from '$lib/model/types';
import type { Guide } from './engine/snapping';
import type { SketchStroke } from './sketch/brushes';

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
	/** The brush stroke being drawn with the sketch tool (board coordinates). */
	sketch = $state<SketchStroke | null>(null);
	/** A connector being drawn (not yet in the document). */
	connector = $state<ConnectorElement | null>(null);
	/** The element a connector end would attach to. */
	connectTarget = $state<string | null>(null);
	/** An element briefly highlighted after jumping to it (mention click); `n` restarts the pulse. */
	pulse = $state<{ id: string; n: number } | null>(null);
}
