import type { BoardContext } from '../context';
import { hitElement } from '../engine/hitTest';
import { groupOf } from '../selectionInfo';
import { screenToWorld } from '../engine/viewport';
import { GESTURE_CANCEL } from '../canvas/viewportInput';
import {
	isDoubleTap,
	isQuickTap,
	LONG_PRESS_MS,
	palmRejected,
	TAP_SLOP,
	TouchPress,
	type Tap
} from './touchGestures';
import type { CanvasPointerEvent } from './types';

const HIT_TOLERANCE_PX = 6;

/**
 * Turns DOM pointer events on the canvas into CanvasPointerEvents for the active tool.
 * Panning gestures are consumed earlier by viewportInput. Usable as a Svelte attachment.
 */
export function pointerRouter(ctx: BoardContext) {
	return (node: HTMLElement) => {
		let active: number | null = null;
		// Fingers (step 37): on empty canvas with Select, one finger pans, a long-press starts a
		// marquee, a tap clears the selection; double-taps act as double-clicks.
		let press: {
			gesture: TouchPress;
			down: CanvasPointerEvent;
			last: { x: number; y: number };
		} | null = null;
		let pressTimer = 0;
		let tapDown: Tap | null = null;
		let lastTap: Tap | null = null;
		let touchDoubleAt = -Infinity;
		// Long-press on an element opens its context menu (step 38).
		let elementPress: { gesture: TouchPress; client: { x: number; y: number } } | null = null;
		let elementTimer = 0;
		let lastTouchAt = -Infinity;
		// Palm rejection: a stylus is down, or when it was last used.
		let penDown = false;
		let penAt = -Infinity;
		const clearPress = () => {
			clearTimeout(pressTimer);
			clearTimeout(elementTimer);
			press = null;
			elementPress = null;
		};
		/** Opens the canvas context menu at a point (iOS fires no contextmenu on long-press). */
		const openMenuAt = (client: { x: number; y: number }) =>
			node.dispatchEvent(
				new MouseEvent('contextmenu', {
					bubbles: true,
					cancelable: true,
					clientX: client.x,
					clientY: client.y,
					button: 2
				})
			);

		const toCanvasEvent = (e: PointerEvent | MouseEvent, withHit: boolean): CanvasPointerEvent => {
			const r = node.getBoundingClientRect();
			const screen = { x: e.clientX - r.left, y: e.clientY - r.top };
			const world = screenToWorld(ctx.viewport.vp, screen);
			const pe = e instanceof PointerEvent ? e : null;
			const hit: CanvasPointerEvent['hit'] = {};
			if (withHit) {
				// Report both: tools give handles priority, but hover must keep the element under the
				// pointer (a port dot's handle overlaps its element; dropping the element would hide it).
				const handle = ctx.handles.hit(screen);
				if (handle) hit.handle = handle;
				const id = hitElement(ctx.store, world, HIT_TOLERANCE_PX / ctx.viewport.zoom);
				if (id) hit.elementId = id;
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
			if (e.pointerType === 'pen') penDown = true;
			if (palmRejected(ctx.tools.current, e.pointerType, penDown, e.timeStamp - penAt)) return;
			node.focus({ preventScroll: true });
			// No emulated mouse events after a touch: their mousedown would steal focus from an
			// editor a double-tap just opened.
			if (e.pointerType === 'touch') e.preventDefault();
			active = e.pointerId;
			node.setPointerCapture(e.pointerId);
			const ce = toCanvasEvent(e, true);
			if (e.pointerType === 'touch') {
				tapDown = { at: ce.screen, t: e.timeStamp };
				lastTouchAt = e.timeStamp;
			}
			if (e.pointerType === 'touch' && ctx.tools.current === 'select' && ce.hit.elementId) {
				const gesture = new TouchPress(ce.screen, e.timeStamp);
				const client = { x: e.clientX, y: e.clientY };
				elementPress = { gesture, client };
				elementTimer = window.setTimeout(() => {
					if (elementPress?.gesture !== gesture || !gesture.hold(gesture.t0 + LONG_PRESS_MS))
						return;
					// Hold still on an element: drop the move it started and show its menu.
					ctx.tools.tool.onCancel();
					if (active !== null && node.hasPointerCapture(active)) node.releasePointerCapture(active);
					active = null;
					elementPress = null;
					openMenuAt(client);
				}, LONG_PRESS_MS);
			}
			if (
				e.pointerType === 'touch' &&
				ctx.tools.current === 'select' &&
				!ce.hit.elementId &&
				!ce.hit.handle
			) {
				const gesture = new TouchPress(ce.screen, e.timeStamp);
				press = { gesture, down: ce, last: ce.screen };
				pressTimer = window.setTimeout(() => {
					if (press?.gesture === gesture && gesture.hold(gesture.t0 + LONG_PRESS_MS))
						ctx.tools.tool.onPointerDown(press.down);
				}, LONG_PRESS_MS);
				return;
			}
			ctx.tools.tool.onPointerDown(ce);
		};

		const onPointerMove = (e: PointerEvent) => {
			const r = node.getBoundingClientRect();
			ctx.pointer = screenToWorld(ctx.viewport.vp, { x: e.clientX - r.left, y: e.clientY - r.top });
			if (active === null) {
				if (fromUi(e) || e.buttons !== 0 || e.pointerType === 'touch') return;
				const ce = toCanvasEvent(e, true);
				ctx.selection.hoverId = ce.hit.elementId ?? null;
				ctx.tools.tool.onPointerMove(ce);
				return;
			}
			if (e.pointerId !== active) return;
			const ce = toCanvasEvent(e, false);
			if (elementPress && elementPress.gesture.move(ce.screen) === 'pan') {
				clearTimeout(elementTimer);
				elementPress = null;
			}
			if (press) {
				const phase = press.gesture.move(ce.screen);
				if (phase === 'pan') {
					clearTimeout(pressTimer);
					ctx.viewport.panBy(ce.screen.x - press.last.x, ce.screen.y - press.last.y);
					press.last = ce.screen;
					return;
				}
				if (phase === 'pending') return;
			}
			ctx.tools.tool.onPointerMove(ce);
		};

		const onPointerUp = (e: PointerEvent) => {
			if (e.pointerType === 'pen') {
				penDown = false;
				penAt = e.timeStamp;
			}
			if (e.pointerId !== active) return;
			const ce = toCanvasEvent(e, true);
			active = null;
			const p = press;
			clearPress();
			if (p && p.gesture.phase === 'pan') return;
			// A long-press on empty canvas that didn't move: the canvas menu instead of a marquee.
			if (
				p?.gesture.phase === 'longpress' &&
				Math.hypot(ce.screen.x - p.gesture.start.x, ce.screen.y - p.gesture.start.y) <= TAP_SLOP
			) {
				ctx.tools.tool.onCancel();
				openMenuAt({ x: e.clientX, y: e.clientY });
				return;
			}
			if (p && p.gesture.isTap(ce.screen)) ctx.tools.tool.onPointerDown(p.down);
			ctx.tools.tool.onPointerUp(ce);
			// A double-tap is a double-click (edit text, play media…).
			if (e.pointerType !== 'touch' || !tapDown) return;
			const up = { at: ce.screen, t: e.timeStamp };
			if (!isQuickTap(tapDown, up)) {
				lastTap = null;
				return;
			}
			if (isDoubleTap(lastTap, up)) {
				lastTap = null;
				touchDoubleAt = e.timeStamp;
				ctx.tools.tool.onDoubleClick?.(ce);
			} else lastTap = up;
		};

		const onPointerCancel = (e: PointerEvent) => {
			if (e.pointerId !== active) return;
			active = null;
			clearPress();
			ctx.tools.tool.onCancel();
		};

		// A pinch started: whatever the first finger began is dropped (nothing moves or selects).
		const onGestureCancel = () => {
			clearPress();
			lastTap = tapDown = null;
			if (active === null) return;
			active = null;
			ctx.tools.tool.onCancel();
		};

		const onPointerLeave = () => {
			if (active === null) ctx.selection.hoverId = null;
		};

		// Right-click acts on what's under the cursor: select it first (the menu opens afterwards).
		const onContextMenu = (e: MouseEvent) => {
			if (fromUi(e)) return;
			// Android's own long-press menu event: ours (untrusted, dispatched above) is the one shown.
			if (e.isTrusted && e.timeStamp - lastTouchAt < 1000) {
				e.preventDefault();
				e.stopPropagation();
				return;
			}
			const ce = toCanvasEvent(e, true);
			ctx.pointer = ce.world;
			const id = ce.hit.elementId;
			const el = id ? ctx.store.get(id) : undefined;
			if (el) {
				if (!ctx.selection.has(el.id)) ctx.selection.set(groupOf(ctx, el));
			} else if (!ce.hit.handle) {
				ctx.selection.clear();
			}
		};

		const onDoubleClick = (e: MouseEvent) => {
			if (fromUi(e)) return;
			// Touch double-taps are handled above; don't act on the browser's copy of one.
			if (e.timeStamp - touchDoubleAt < 600) return;
			ctx.tools.tool.onDoubleClick?.(toCanvasEvent(e, true));
		};

		node.addEventListener('pointerdown', onPointerDown);
		node.addEventListener('pointermove', onPointerMove);
		node.addEventListener('pointerup', onPointerUp);
		node.addEventListener('pointercancel', onPointerCancel);
		node.addEventListener('lostpointercapture', onPointerCancel);
		node.addEventListener('pointerleave', onPointerLeave);
		node.addEventListener('dblclick', onDoubleClick);
		node.addEventListener('contextmenu', onContextMenu);
		node.addEventListener(GESTURE_CANCEL, onGestureCancel);
		return () => {
			clearPress();
			node.removeEventListener(GESTURE_CANCEL, onGestureCancel);
			node.removeEventListener('contextmenu', onContextMenu);
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
