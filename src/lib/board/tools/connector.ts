import type { BoardContext } from '../context';
import { createConnectGesture, endpointAt } from '../diagram/connectGesture';
import type { Tool } from './types';

/** Drag from anything (or empty canvas) to anything: creates a connector. */
export function createConnectorTool(ctx: BoardContext): Tool {
	let gesture: ReturnType<typeof createConnectGesture> | null = null;

	return {
		id: 'connector',
		cursor: 'crosshair',
		onPointerDown(e) {
			const { endpoint } = endpointAt(ctx, e.world, e.alt, null);
			gesture = createConnectGesture(ctx, endpoint, e.screen);
			gesture.move(e.world, e.alt);
		},
		onPointerMove(e) {
			if (gesture && e.dragging) gesture.move(e.world, e.alt);
			else if (!e.dragging) {
				// Hover feedback: highlight what a connector would start from.
				ctx.preview.connectTarget = endpointAt(ctx, e.world, e.alt, null).target?.id ?? null;
			}
		},
		onPointerUp(e) {
			if (!gesture) return;
			const id = gesture.finish(e.world, e.screen, e.alt);
			gesture = null;
			if (id) {
				ctx.selection.set([id]);
				ctx.tools.returnToSelect();
			}
		},
		onCancel() {
			gesture?.cancel();
			gesture = null;
			ctx.preview.connectTarget = null;
		}
	};
}
