import type { BoardContext } from '../context';
import { hitElement } from '../engine/hitTest';
import { screenToWorld } from '../engine/viewport';
import type { CanvasPointerEvent } from './types';

const HIT_TOLERANCE_PX = 6;

/**
 * Turns DOM pointer events on the canvas into CanvasPointerEvents for the active tool.
 * Panning gestures are consumed earlier by viewportInput. Usable as a Svelte attachment.
 */
export function pointerRouter(ctx: BoardContext) {
	return (node: HTMLElement) => {
		let active: number | null = null;

		const toCanvasEvent = (e: PointerEvent | MouseEvent, withHit: boolean): CanvasPointerEvent => {
			const r = node.getBoundingClientRect();
			const screen = { x: e.clientX - r.left, y: e.clientY - r.top };
			const world = screenToWorld(ctx.viewport.vp, screen);
			const pe = e instanceof PointerEvent ? e : null;
			const hit: CanvasPointerEvent['hit'] = {};
			if (withHit) {
				const handle = ctx.handles.hit(screen);
				if (handle) hit.handle = handle;
				else {
					const id = hitElement(ctx.store, world, HIT_TOLERANCE_PX / ctx.viewport.zoom);
					if (id) hit.elementId = id;
				}
			}
			return {
				world,
				screen,
				button: e.button,
				dragging: active !== null,
				pointerId: pe?.pointerId ?? 1,
				pointerType: pe?.pointerType ?? 'mouse',
				pressure: pe?.pressure ?? 0.5,
				shift: e.shiftKey,
				alt: e.altKey,
				mod: e.ctrlKey || e.metaKey,
				hit,
				native: e
			};
		};

		// Events from floating UI inside the canvas (popovers, editors) aren't canvas gestures.
		const fromUi = (e: Event) =>
			e.target instanceof Element && !!e.target.closest('[data-interactive]');

		const onPointerDown = (e: PointerEvent) => {
			if (e.defaultPrevented || fromUi(e) || e.button !== 0 || !e.isPrimary) return;
			if (active !== null) return;
			node.focus({ preventScroll: true });
			active = e.pointerId;
			node.setPointerCapture(e.pointerId);
			ctx.tools.tool.onPointerDown(toCanvasEvent(e, true));
		};

		const onPointerMove = (e: PointerEvent) => {
			if (active === null) {
				if (fromUi(e) || e.buttons !== 0 || e.pointerType === 'touch') return;
				const ce = toCanvasEvent(e, true);
				ctx.selection.hoverId = ce.hit.elementId ?? null;
				ctx.tools.tool.onPointerMove(ce);
				return;
			}
			if (e.pointerId !== active) return;
			ctx.tools.tool.onPointerMove(toCanvasEvent(e, false));
		};

		const onPointerUp = (e: PointerEvent) => {
			if (e.pointerId !== active) return;
			const ce = toCanvasEvent(e, true);
			active = null;
			ctx.tools.tool.onPointerUp(ce);
		};

		const onPointerCancel = (e: PointerEvent) => {
			if (e.pointerId !== active) return;
			active = null;
			ctx.tools.tool.onCancel();
		};

		const onPointerLeave = () => {
			if (active === null) ctx.selection.hoverId = null;
		};

		const onDoubleClick = (e: MouseEvent) => {
			if (fromUi(e)) return;
			ctx.tools.tool.onDoubleClick?.(toCanvasEvent(e, true));
		};

		node.addEventListener('pointerdown', onPointerDown);
		node.addEventListener('pointermove', onPointerMove);
		node.addEventListener('pointerup', onPointerUp);
		node.addEventListener('pointercancel', onPointerCancel);
		node.addEventListener('lostpointercapture', onPointerCancel);
		node.addEventListener('pointerleave', onPointerLeave);
		node.addEventListener('dblclick', onDoubleClick);
		return () => {
			node.removeEventListener('pointerdown', onPointerDown);
			node.removeEventListener('pointermove', onPointerMove);
			node.removeEventListener('pointerup', onPointerUp);
			node.removeEventListener('pointercancel', onPointerCancel);
			node.removeEventListener('lostpointercapture', onPointerCancel);
			node.removeEventListener('pointerleave', onPointerLeave);
			node.removeEventListener('dblclick', onDoubleClick);
		};
	};
}
