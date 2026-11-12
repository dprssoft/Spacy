import { cloneElements } from '$lib/model/clone';
import { createElements, updateElements } from '$lib/model/ops';
import type {
	ConnectorElement,
	Element,
	ElementPatch,
	Endpoint,
	Point,
	Port,
	Rect
} from '$lib/model/types';
import { compareZ } from '$lib/model/zorder';
import type { BoardContext } from '../context';
import { definitionOf } from '../elements';
import { rectCenter, rectFromPoints, unionRects } from '../engine/geometry';
import { hitElementsInRect } from '../engine/hitTest';
import {
	cursorForHandle,
	isResizeHandle,
	resizeBox,
	resizeHandlePoint,
	rotateElementsAround,
	scaleElementsToBox,
	sizePatch,
	snapAngle,
	type Box,
	type ResizeHandle
} from '../engine/transform';
import { syncFrameMembership, withFrameChildren } from '../frameMembership';
import { groupOf, targetsBox, transformTargets } from '../selectionInfo';
import { createText } from './create';
import { createSnapper, type Snapper } from './snapper';
import { createConnectGesture, createEndpointDrag } from '../diagram/connectGesture';
import { makeEndpoint } from '../diagram/endpoints';
import { connectorGeometry } from '../diagram/geometry';
import { nearestT } from '../diagram/routing';
import { undoGesture } from './gesture';
import { now } from '../widgets/clock';
import { actionAt, primaryAction } from '../widgets/layout';
import { createRafWriter } from './rafBatch';
import type { CanvasPointerEvent, Tool } from './types';

const DRAG_THRESHOLD_PX = 3;
const MIN_SIZE = 8;

type Patches = { id: string; patch: ElementPatch }[];

type State =
	| { kind: 'idle' }
	/**
	 * Pressed on an element; becomes 'moving' past the drag threshold. `action`: pressed on a
	 * widget's button, which runs on release if the pointer didn't move.
	 */
	| {
			kind: 'pointing';
			start: Point;
			startScreen: Point;
			clickedId: string;
			wasSelected: boolean;
			action?: string;
	  }
	| {
			kind: 'moving';
			start: Point;
			snapshot: Element[];
			/** Selected connectors with free ends: those ends move with the selection. */
			connectors: ConnectorElement[];
			box: Rect | null;
			snapper: Snapper;
	  }
	| { kind: 'connecting'; gesture: ReturnType<typeof createConnectGesture> }
	| { kind: 'endpoint'; drag: ReturnType<typeof createEndpointDrag> }
	| { kind: 'label'; connector: ConnectorElement }
	/** Sliding an elbow segment perpendicular to itself. */
	| { kind: 'segment'; id: string; points: Point[]; index: number; start: Point }
	/** Moving a bend point of a straight/curved connector. */
	| { kind: 'waypoint'; id: string; index: number }
	| { kind: 'marquee'; start: Point; base: string[] }
	| {
			kind: 'resizing';
			handle: ResizeHandle;
			box: Box;
			/** Handle position minus the pointer at press: the handle keeps that offset. */
			grab: Point;
			snapshot: Element[];
			snapper: Snapper;
	  }
	| { kind: 'rotating'; center: Point; startAngle: number; snapshot: Element[] };

/** Click/Shift/marquee selection, move (Alt duplicates, Shift locks axis), resize, rotate. */
export function createSelectTool(ctx: BoardContext): Tool {
	const { selection, store, doc, undo } = ctx;
	const gesture = undoGesture(undo);
	const writer = createRafWriter<Patches>((patches) => updateElements(doc, patches));
	const ui = $state({ cursor: 'default' });
	let state: State = { kind: 'idle' };
	let undoDepth = 0;

	const selectedIds = () => [...selection.ids];

	function beginTransform() {
		undoDepth = undo.undoStack.length;
		gesture.begin();
		selection.transforming = true;
	}

	function endTransform(snapshot: readonly Element[]) {
		writer.flush();
		// Moved/resized elements may have entered or left frames: same undo step as the gesture.
		// A one-off lookup, not reactive state.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const before = new Map(snapshot.filter((el) => el.type === 'frame').map((f) => [f.id, f]));
		syncFrameMembership(
			ctx,
			snapshot.map((el) => el.id),
			before
		);
		gesture.end();
		selection.transforming = false;
	}

	const idsIn = (els: readonly Element[], id: string) => els.some((e) => e.id === id);

	/** Alt-drag: copies the targets (keeping their stacking order) and selects the copies. */
	function duplicateForDrag(targets: Element[]): Element[] {
		const sorted = [...targets].sort((a, b) => compareZ(a.z, b.z));
		const { elements } = cloneElements(sorted, { offset: { x: 0, y: 0 } });
		const created = createElements(doc, elements);
		selection.set(
			created.filter((e) => !e.parentId || !idsIn(created, e.parentId)).map((e) => e.id)
		);
		return created;
	}

	function startMoving(e: CanvasPointerEvent, start: Point) {
		beginTransform();
		// A frame carries its contents along.
		let targets = withFrameChildren(ctx, transformTargets(ctx));
		if (e.alt && targets.length > 0) targets = duplicateForDrag(targets);
		const box = unionRects(targets.flatMap((el) => store.index.get(el.id) ?? []));
		const snapper = createSnapper(
			ctx,
			targets.map((el) => el.id)
		);
		const connectors = [...selection.ids]
			.map((id) => store.get(id))
			.filter(
				(el): el is ConnectorElement =>
					el?.type === 'connector' &&
					!el.locked &&
					(el.from.kind === 'free' || el.to.kind === 'free')
			);
		state = { kind: 'moving', start, snapshot: targets, connectors, box, snapper };
		ui.cursor = 'move';
	}

	function move(e: CanvasPointerEvent, s: Extract<State, { kind: 'moving' }>) {
		let dx = e.world.x - s.start.x;
		let dy = e.world.y - s.start.y;
		let lock: 'x' | 'y' | null = null;
		if (e.shift) {
			lock = Math.abs(dx) > Math.abs(dy) ? 'y' : 'x';
			if (lock === 'y') dy = 0;
			else dx = 0;
		}
		if (s.box) {
			const c = s.snapper.move({ ...s.box, x: s.box.x + dx, y: s.box.y + dy }, e.mod);
			if (lock !== 'x') dx += c.dx;
			if (lock !== 'y') dy += c.dy;
		}
		const shift = (ep: Endpoint): Endpoint =>
			ep.kind === 'free' ? { ...ep, x: ep.x + dx, y: ep.y + dy } : ep;
		writer.push([
			...s.snapshot.map((el) => ({ id: el.id, patch: { x: el.x + dx, y: el.y + dy } })),
			...s.connectors.map((c) => ({
				id: c.id,
				patch: {
					from: shift(c.from),
					to: shift(c.to),
					// Bends only follow when nothing anchors the connector.
					waypoints:
						c.from.kind === 'free' && c.to.kind === 'free'
							? c.waypoints.map((w) => ({ x: w.x + dx, y: w.y + dy }))
							: c.waypoints
				}
			}))
		]);
	}

	function marquee(e: CanvasPointerEvent, s: Extract<State, { kind: 'marquee' }>) {
		const rect = rectFromPoints(s.start, e.world);
		selection.marquee = rect;
		// Per-move lookup sets, not reactive state (the selection is).
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const hit = new Set(s.base);
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const contained = new Set(hitElementsInRect(store, rect, 'contain'));
		for (const id of hitElementsInRect(store, rect, 'intersect')) {
			const el = store.get(id);
			if (!el || el.locked) continue;
			// Frames are only picked when fully enclosed, so marquees inside a frame work.
			if (el.type === 'frame' && !contained.has(id)) continue;
			for (const gid of groupOf(ctx, el)) hit.add(gid);
		}
		selection.set(hit);
	}

	function resize(e: CanvasPointerEvent, s: Extract<State, { kind: 'resizing' }>) {
		// Without the grab offset, pressing a handle off-centre would make the box jump.
		const at = { x: e.world.x + s.grab.x, y: e.world.y + s.grab.y };
		// Snap the dragged handle (only for unrotated boxes: guides are axis-aligned).
		const pointer = s.box.rotation === 0 ? s.snapper.point(at, e.mod) : at;
		e = { ...e, world: pointer };
		if (s.snapshot.length === 1) {
			const el = s.snapshot[0]!;
			const def = definitionOf(el);
			const keepAspect = e.shift !== def.keepAspect;
			const next = resizeBox(s.box, s.handle, e.world, {
				keepAspect,
				fromCenter: e.alt,
				minSize: MIN_SIZE,
				limits: def.sizeLimits?.(el)
			});
			writer.push([
				{ id: el.id, patch: { ...sizePatch(el, next.w, next.h), x: next.x, y: next.y } }
			]);
			return;
		}
		const next = resizeBox(s.box, s.handle, e.world, {
			keepAspect: e.shift,
			fromCenter: e.alt,
			minSize: MIN_SIZE
		});
		writer.push(scaleElementsToBox(s.snapshot, s.box, next));
	}

	function rotate(e: CanvasPointerEvent, s: Extract<State, { kind: 'rotating' }>) {
		const angle = Math.atan2(e.world.y - s.center.y, e.world.x - s.center.x);
		let delta = angle - s.startAngle;
		if (s.snapshot.length === 1) {
			const el = s.snapshot[0]!;
			let rotation = el.rotation + delta;
			if (e.shift) rotation = snapAngle(rotation);
			writer.push([{ id: el.id, patch: { rotation } }]);
			return;
		}
		if (e.shift) delta = snapAngle(delta);
		writer.push(rotateElementsAround(s.snapshot, s.center, delta));
	}

	function clearGuides() {
		ctx.preview.guides = [];
		ctx.preview.gaps = [];
	}

	function cancel() {
		clearGuides();
		if (state.kind === 'connecting') state.gesture.cancel();
		if (state.kind === 'endpoint') state.drag.cancel();
		const transforming = [
			'moving',
			'resizing',
			'rotating',
			'label',
			'segment',
			'waypoint'
		].includes(state.kind);
		writer.cancel();
		if (transforming) {
			gesture.end();
			selection.transforming = false;
			// Revert the whole gesture (including Alt-duplicated copies) without leaving a redo step.
			if (undo.undoStack.length > undoDepth) {
				undo.undo();
				undo.clear(false, true);
			}
		}
		selection.marquee = null;
		state = { kind: 'idle' };
		ui.cursor = 'default';
	}

	return {
		id: 'select',
		get cursor() {
			return ui.cursor;
		},

		onPointerDown(e) {
			const handle = e.hit.handle;
			if (handle?.startsWith('port:')) {
				// Dragging from a hovered element's port dot draws a connector.
				const [, id, port] = handle.split(':');
				const el = id ? store.get(id) : undefined;
				const c = el ? definitionOf(el).connectable : null;
				if (el && c) {
					const at = c.ports(el)[port as Port];
					const from = makeEndpoint(el, c, at, 'auto', 1);
					state = { kind: 'connecting', gesture: createConnectGesture(ctx, from, e.screen) };
				}
				return;
			}
			if (handle && (handle.startsWith('bend:') || handle.startsWith('wp:'))) {
				const c = selection.single ? store.get(selection.single) : undefined;
				if (c?.type !== 'connector') return;
				const index = Number(handle.split(':')[1]);
				beginTransform();
				if (handle.startsWith('wp:')) {
					state = { kind: 'waypoint', id: c.id, index };
				} else if (c.routing === 'elbow') {
					state = {
						kind: 'segment',
						id: c.id,
						points: connectorGeometry(c, store.world).points,
						index,
						start: e.world
					};
				} else {
					// Insert a bend between control points `index` and `index + 1`, then drag it.
					const waypoints = [...c.waypoints];
					waypoints.splice(index, 0, e.world);
					writer.push([{ id: c.id, patch: { waypoints } }]);
					state = { kind: 'waypoint', id: c.id, index };
				}
				return;
			}
			if (handle === 'label') {
				const c = selection.single ? store.get(selection.single) : undefined;
				if (c?.type === 'connector') {
					beginTransform();
					state = { kind: 'label', connector: c };
				}
				return;
			}
			if (handle === 'end:from' || handle === 'end:to') {
				const id = selection.single;
				if (id)
					state = {
						kind: 'endpoint',
						drag: createEndpointDrag(ctx, id, handle === 'end:from' ? 'from' : 'to')
					};
				return;
			}
			if (handle) {
				const targets = transformTargets(ctx);
				const box = targetsBox(targets);
				if (!box) return;
				beginTransform();
				if (handle === 'rotate') {
					const center = rectCenter(box);
					const startAngle = Math.atan2(e.world.y - center.y, e.world.x - center.x);
					state = { kind: 'rotating', center, startAngle, snapshot: targets };
				} else if (isResizeHandle(handle)) {
					const snapper = createSnapper(
						ctx,
						targets.map((el) => el.id)
					);
					const h = resizeHandlePoint(box, handle);
					const grab = { x: h.x - e.world.x, y: h.y - e.world.y };
					state = { kind: 'resizing', handle, box, grab, snapshot: targets, snapper };
				}
				return;
			}

			const id = e.hit.elementId;
			const el = id ? store.get(id) : undefined;
			const action = el?.type === 'widget' && !e.shift ? actionAt(el, e.world, now()) : null;
			if (el && action) {
				// A widget's button: runs on release; the selection stays as it is unless it drags.
				state = {
					kind: 'pointing',
					start: e.world,
					startScreen: e.screen,
					clickedId: el.id,
					wasSelected: false,
					action: action.id
				};
				return;
			}
			if (el) {
				const ids = groupOf(ctx, el);
				const wasSelected = ids.every((g) => selection.has(g));
				if (el.groupId && selection.enteredGroup !== el.groupId) selection.enteredGroup = null;
				if (e.shift) {
					for (const g of ids) {
						if (wasSelected) selection.ids.delete(g);
						else selection.add(g);
					}
				} else if (!wasSelected) {
					selection.set(ids);
				}
				state = {
					kind: 'pointing',
					start: e.world,
					startScreen: e.screen,
					clickedId: el.id,
					wasSelected: wasSelected && !e.shift
				};
				return;
			}

			const base = e.shift ? selectedIds() : [];
			if (!e.shift) selection.clear();
			state = { kind: 'marquee', start: e.world, base };
		},

		onPointerMove(e) {
			if (!e.dragging) {
				const h = e.hit.handle;
				const hovered = !h && e.hit.elementId ? store.get(e.hit.elementId) : undefined;
				const action = hovered?.type === 'widget' ? actionAt(hovered, e.world, now()) : null;
				const hover = action && hovered ? { id: hovered.id, action: action.id } : null;
				if (ctx.widgets.hover?.id !== hover?.id || ctx.widgets.hover?.action !== hover?.action)
					ctx.widgets.hover = hover;
				if (action) ui.cursor = 'pointer';
				else if (h === 'rotate') ui.cursor = 'grab';
				else if (h && isResizeHandle(h)) {
					const single = transformTargets(ctx);
					ui.cursor = cursorForHandle(h, single.length === 1 ? single[0]!.rotation : 0);
				} else ui.cursor = 'default';
				return;
			}
			const s = state;
			switch (s.kind) {
				case 'pointing': {
					const moved = Math.hypot(e.screen.x - s.startScreen.x, e.screen.y - s.startScreen.y);
					if (moved >= DRAG_THRESHOLD_PX) {
						if (s.action) {
							// Dragging from a widget's button moves the widget.
							const el = store.get(s.clickedId);
							if (el && !selection.has(el.id)) selection.set(groupOf(ctx, el));
						}
						startMoving(e, s.start);
						if (state.kind === 'moving') move(e, state);
					}
					return;
				}
				case 'moving':
					return move(e, s);
				case 'marquee':
					return marquee(e, s);
				case 'resizing':
					return resize(e, s);
				case 'rotating':
					return rotate(e, s);
				case 'connecting':
					return s.gesture.move(e.world, e.alt);
				case 'endpoint':
					return s.drag.move(e.world, e.alt);
				case 'segment': {
					const a = s.points[s.index]!;
					const b = s.points[s.index + 1]!;
					const horizontal = Math.abs(a.y - b.y) < 1e-6;
					const d = horizontal ? e.world.y - s.start.y : e.world.x - s.start.x;
					const moved = s.points.map((p, i) =>
						i === s.index || i === s.index + 1
							? horizontal
								? { x: p.x, y: p.y + d }
								: { x: p.x + d, y: p.y }
							: p
					);
					return writer.push([{ id: s.id, patch: { waypoints: moved.slice(1, -1) } }]);
				}
				case 'waypoint': {
					const c = store.get(s.id);
					if (c?.type !== 'connector') return;
					const waypoints = c.waypoints.map((w, i) => (i === s.index ? e.world : w));
					return writer.push([{ id: s.id, patch: { waypoints } }]);
				}
				case 'label': {
					const current = store.get(s.connector.id);
					if (current?.type !== 'connector') return;
					const { t } = nearestT(connectorGeometry(current, store.world).route, e.world);
					return writer.push([{ id: current.id, patch: { label: { ...current.label, t } } }]);
				}
			}
		},

		onPointerUp(e) {
			const s = state;
			if (s.kind === 'connecting') {
				const id = s.gesture.finish(e.world, e.screen, e.alt);
				if (id) selection.set([id]);
			} else if (s.kind === 'endpoint') {
				s.drag.finish();
			} else if (s.kind === 'label' || s.kind === 'segment' || s.kind === 'waypoint') {
				endTransform([]);
			} else if (s.kind === 'moving' || s.kind === 'resizing' || s.kind === 'rotating') {
				endTransform(s.snapshot); // the last move already pushed the final position
				clearGuides();
			} else if (s.kind === 'pointing' && s.action) {
				ctx.widgets.run(s.clickedId, s.action);
			} else if (s.kind === 'pointing' && s.wasSelected && !e.shift) {
				// Click (no drag) on an element of a multi-selection: select just its group.
				const el = store.get(s.clickedId);
				if (el) selection.set(groupOf(ctx, el));
			}
			selection.marquee = null;
			state = { kind: 'idle' };
			ui.cursor = 'default';
		},

		onDoubleClick(e) {
			if (e.hit.handle?.startsWith('wp:') && selection.single) {
				// Double-click a bend point to remove it.
				const c = store.get(selection.single);
				if (c?.type === 'connector') {
					const index = Number(e.hit.handle.split(':')[1]);
					undo.stopCapturing();
					updateElements(doc, [
						{ id: c.id, patch: { waypoints: c.waypoints.filter((_, i) => i !== index) } }
					]);
					undo.stopCapturing();
				}
				return;
			}
			const id = e.hit.elementId;
			const el = id ? store.get(id) : undefined;
			if (el?.groupId && selection.enteredGroup !== el.groupId && selection.size > 1) {
				// Enter the group: select just this member.
				selection.enteredGroup = el.groupId;
				selection.set([el.id]);
				return;
			}
			if (el?.type === 'sketch' && !el.locked) {
				// Continue drawing in it.
				selection.set([el.id]);
				ctx.tools.setTool('sketch');
				return;
			}
			if (el?.type === 'widget') {
				// Quick clicks on its buttons aren't a request for its settings.
				if (!actionAt(el, e.world, now())) ctx.widgets.openSettings(el.id);
				return;
			}
			if (el?.type === 'media') {
				// Play it and hand the pointer to the player (its own controls).
				ctx.playback.play(el.id);
				ctx.editing.start(el.id);
				return;
			}
			if (el && !el.locked && definitionOf(el).editableText) {
				const n = e.native;
				ctx.editing.start(el.id, { at: { x: n.clientX, y: n.clientY } });
			} else if (!id) {
				// Whiteboard convenience: double-click empty canvas to write.
				undo.stopCapturing();
				ctx.editing.start(createText(ctx, e.world), { discardIfEmpty: true });
			}
		},

		onKeyDown(e) {
			if (e.key === 'Escape' && state.kind !== 'idle') {
				cancel();
				return true;
			}
			if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.altKey) return false;
			const id = selection.single;
			const el = id ? store.get(id) : undefined;
			if (el?.type === 'widget') {
				// Enter runs its main button; Shift+Enter opens its settings.
				if (e.shiftKey) ctx.widgets.openSettings(el.id);
				else {
					const primary = primaryAction(el, now());
					if (primary) ctx.widgets.run(el.id, primary.id);
				}
				return true;
			}
			if (e.shiftKey) return false;
			if (el?.type === 'media') {
				ctx.playback.play(el.id);
				ctx.editing.start(el.id);
				return true;
			}
			if (!el || el.locked || !definitionOf(el).editableText) return false;
			ctx.editing.start(el.id);
			return true;
		},

		onCancel: cancel
	};
}
