import type { Point } from '$lib/model/types';
import type { BoardContext } from '../context';
import type { Tool } from './types';

/** Drag to pan. */
export function createHandTool(ctx: BoardContext): Tool {
	let last: Point | null = null;
	const state = $state({ grabbing: false });

	return {
		id: 'hand',
		get cursor() {
			return state.grabbing ? 'grabbing' : 'grab';
		},
		onPointerDown(e) {
			last = e.screen;
			state.grabbing = true;
		},
		onPointerMove(e) {
			if (!last || !e.dragging) return;
			ctx.viewport.panBy(e.screen.x - last.x, e.screen.y - last.y);
			last = e.screen;
		},
		onPointerUp() {
			last = null;
			state.grabbing = false;
		},
		onCancel() {
			last = null;
			state.grabbing = false;
		}
	};
}
