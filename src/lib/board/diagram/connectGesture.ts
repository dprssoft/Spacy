import { updateElement } from '$lib/model/ops';
import type { ConnectorElement, Element, Endpoint, Point } from '$lib/model/types';
import type { BoardContext } from '../context';
import { definitionOf } from '../elements';
import { pointInRotatedRect } from '../engine/geometry';
import { undoGesture } from '../tools/gesture';
import { createRafWriter } from '../tools/rafBatch';
import { freeEndpoint, makeEndpoint } from './endpoints';
import { createConnector, newConnector } from './ops';

const PORT_RADIUS_PX = 12;
const HIT_PX = 6;
const MIN_LENGTH_PX = 8;

/**
 * The connectable element under `p` (connectors skipped, `exclude` skipped): pointer inside its box;
 * other elements win over frames, then the higher one wins.
 */
export function connectableAt(ctx: BoardContext, p: Point, exclude: string | null): Element | null {
	const tol = HIT_PX / ctx.viewport.zoom;
	let best: Element | null = null;
	const rank = (el: Element) => (el.type === 'frame' ? 0 : 1);
	for (const id of ctx.store.index.near(p, tol)) {
		if (id === exclude) continue;
		const el = ctx.store.get(id);
		if (!el || el.type === 'connector' || !definitionOf(el).connectable) continue;
		if (!pointInRotatedRect(p, el, el.rotation, tol)) continue;
		if (!best || rank(el) > rank(best) || (rank(el) === rank(best) && el.z > best.z)) best = el;
	}
	return best;
}

/** The endpoint for pointer `p`: attached to the element under it (Alt = exact spot), else free. */
export function endpointAt(
	ctx: BoardContext,
	p: Point,
	alt: boolean,
	exclude: string | null
): { endpoint: Endpoint; target: Element | null } {
	const target = connectableAt(ctx, p, exclude);
	if (!target) return { endpoint: freeEndpoint(p), target: null };
	const c = definitionOf(target).connectable!;
	return {
		endpoint: makeEndpoint(
			target,
			c,
			p,
			alt ? 'fixed' : 'auto',
			PORT_RADIUS_PX / ctx.viewport.zoom
		),
		target
	};
}

const sourceId = (ep: Endpoint) => (ep.kind === 'free' ? null : ep.elementId);

/**
 * Drawing a new connector from `from`: previews it, highlights the element under the pointer,
 * and creates it on release (unless it's too short). Self-loops are not allowed.
 */
export function createConnectGesture(ctx: BoardContext, from: Endpoint, startScreen: Point) {
	let to: Endpoint = from.kind === 'free' ? from : freeEndpoint({ x: from.lastX, y: from.lastY });

	const update = (p: Point, alt: boolean) => {
		const r = endpointAt(ctx, p, alt, sourceId(from));
		to = r.endpoint;
		ctx.preview.connector = { ...newConnector(from, to), z: '' } as ConnectorElement;
		ctx.preview.connectTarget = r.target ? r.target.id : null;
	};

	return {
		move(p: Point, alt: boolean) {
			update(p, alt);
		},
		/** Creates the connector; returns its id, or null if the drag was too short. */
		finish(p: Point, screen: Point, alt: boolean): string | null {
			update(p, alt);
			this.cancel();
			if (Math.hypot(screen.x - startScreen.x, screen.y - startScreen.y) < MIN_LENGTH_PX)
				return null;
			ctx.undo.stopCapturing();
			const id = createConnector(ctx.doc, from, to);
			ctx.undo.stopCapturing();
			return id;
		},
		cancel() {
			ctx.preview.connector = null;
			ctx.preview.connectTarget = null;
		}
	};
}

/** Dragging one end of an existing connector: re-attaches on hover, detaches over empty canvas. */
export function createEndpointDrag(ctx: BoardContext, connectorId: string, which: 'from' | 'to') {
	const gesture = undoGesture(ctx.undo);
	const writer = createRafWriter<Endpoint>((ep) =>
		updateElement(ctx.doc, connectorId, { [which]: ep })
	);
	const depth = ctx.undo.undoStack.length;
	gesture.begin();
	const other = (): string | null => {
		const c = ctx.store.get(connectorId);
		if (c?.type !== 'connector') return null;
		return sourceId(which === 'from' ? c.to : c.from);
	};
	return {
		move(p: Point, alt: boolean) {
			const r = endpointAt(ctx, p, alt, other());
			ctx.preview.connectTarget = r.target ? r.target.id : null;
			writer.push(r.endpoint);
		},
		finish() {
			writer.flush();
			gesture.end();
			ctx.preview.connectTarget = null;
		},
		/** Reverts the drag entirely (no undo/redo step left). */
		cancel() {
			writer.cancel();
			gesture.end();
			ctx.preview.connectTarget = null;
			if (ctx.undo.undoStack.length > depth) {
				ctx.undo.undo();
				ctx.undo.clear(false, true);
			}
		}
	};
}
