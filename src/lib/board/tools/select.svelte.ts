import { cloneElements } from '$lib/model/clone';
import { createElements, updateElements } from '$lib/model/ops';
import type { Element, ElementPatch, Point } from '$lib/model/types';
import { compareZ } from '$lib/model/zorder';
import type { BoardContext } from '../context';
import { definitionOf } from '../elements';
import { rectCenter, rectFromPoints } from '../engine/geometry';
import { hitElementsInRect } from '../engine/hitTest';
import {
	cursorForHandle,
	isResizeHandle,
	resizeBox,
	rotateElementsAround,
	scaleElementsToBox,
	sizePatch,
	snapAngle,
	type Box,
	type ResizeHandle
} from '../engine/transform';
import { groupOf, targetsBox, transformTargets } from '../selectionInfo';
import { createText } from './create';
import { undoGesture } from './gesture';
import { createRafWriter } from './rafBatch';
import type { CanvasPointerEvent, Tool } from './types';

const DRAG_THRESHOLD_PX = 3;
const MIN_SIZE = 8;

type Patches = { id: string; patch: ElementPatch }[];

type State =
	| { kind: 'idle' }
	/** Pressed on an element; becomes 'moving' past the drag threshold. */
	| { kind: 'pointing'; start: Point; startScreen: Point; clickedId: string; wasSelected: boolean }
	| { kind: 'moving'; start: Point; snapshot: Element[] }
	| { kind: 'marquee'; start: Point; base: string[] }
	| { kind: 'resizing'; handle: ResizeHandle; box: Box; snapshot: Element[] }
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

	function endTransform() {
		writer.flush();
		gesture.end();
		selection.transforming = false;
	}

	/** Alt-drag: copies the targets (keeping their stacking order) and selects the copies. */
	function duplicateForDrag(targets: Element[]): Element[] {
		const sorted = [...targets].sort((a, b) => compareZ(a.z, b.z));
		const { elements } = cloneElements(sorted, { offset: { x: 0, y: 0 } });
		const created = createElements(doc, elements);
		selection.set(created.map((e) => e.id));
		return created;
	}

	function startMoving(e: CanvasPointerEvent, start: Point) {
		beginTransform();
		let targets = transformTargets(ctx);
		if (e.alt && targets.length > 0) targets = duplicateForDrag(targets);
		state = { kind: 'moving', start, snapshot: targets };
		ui.cursor = 'move';
	}

	function move(e: CanvasPointerEvent, s: Extract<State, { kind: 'moving' }>) {
		let dx = e.world.x - s.start.x;
		let dy = e.world.y - s.start.y;
		if (e.shift) {
			if (Math.abs(dx) > Math.abs(dy)) dy = 0;
			else dx = 0;
		}
		writer.push(s.snapshot.map((el) => ({ id: el.id, patch: { x: el.x + dx, y: el.y + dy } })));
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
		if (s.snapshot.length === 1) {
			const el = s.snapshot[0]!;
			const keepAspect = e.shift !== definitionOf(el).keepAspect;
			const next = resizeBox(s.box, s.handle, e.world, {
				keepAspect,
				fromCenter: e.alt,
				minSize: MIN_SIZE
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

	function cancel() {
		const transforming =
			state.kind === 'moving' || state.kind === 'resizing' || state.kind === 'rotating';
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
					state = { kind: 'resizing', handle, box, snapshot: targets };
				}
				return;
			}

			const id = e.hit.elementId;
			const el = id ? store.get(id) : undefined;
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
				if (h === 'rotate') ui.cursor = 'grab';
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
			}
		},

		onPointerUp(e) {
			const s = state;
			if (s.kind === 'moving' || s.kind === 'resizing' || s.kind === 'rotating') {
				endTransform(); // the last move already pushed the final position
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
			const id = e.hit.elementId;
			const el = id ? store.get(id) : undefined;
			if (el?.groupId && selection.enteredGroup !== el.groupId && selection.size > 1) {
				// Enter the group: select just this member.
				selection.enteredGroup = el.groupId;
				selection.set([el.id]);
				return;
			}
			if (el && !el.locked && definitionOf(el).editableText) {
				ctx.editing.start(el.id);
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
			if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return false;
			const id = selection.single;
			const el = id ? store.get(id) : undefined;
			if (!el || el.locked || !definitionOf(el).editableText) return false;
			ctx.editing.start(el.id);
			return true;
		},

		onCancel: cancel
	};
}
