import { GRID_SIZE } from '$lib/model/defaults';
import type { FrameElement, Point, Rect } from '$lib/model/types';
import type { BoardContext } from '../context';
import { frameFor } from '../engine/frames';
import { expandRectRatio, rectCenter } from '../engine/geometry';
import { snapMoveEqual, type GapMark } from '../engine/gapSnapping';
import { snapPoint, snapToGrid, type Guide } from '../engine/snapping';
import { visibleWorldRect } from '../engine/viewport';

const THRESHOLD_PX = 6;
const MAX_CANDIDATES = 300;

/**
 * Snapping for one gesture: smart guides to nearby elements' edges and centers, equal gaps when
 * moving, then (per axis, if nothing matched) the grid when "Snap to grid" is on. Holding Ctrl/Cmd disables snapping.
 * Candidates are collected once, when the gesture starts.
 */
export function createSnapper(ctx: BoardContext, excludeIds: Iterable<string> = []) {
	const exclude = new Set(excludeIds);
	const view = expandRectRatio(visibleWorldRect(ctx.viewport.vp, ctx.viewport.size), 0.25);
	const c = rectCenter(view);
	const items = ctx.store.index
		.search(view)
		.flatMap((id) => {
			const el = ctx.store.get(id);
			const rect = ctx.store.index.get(id);
			return !exclude.has(id) && el && rect && el.type !== 'connector' ? [{ el, rect }] : [];
		})
		.sort(
			(a, b) =>
				Math.hypot(a.rect.x - c.x, a.rect.y - c.y) - Math.hypot(b.rect.x - c.x, b.rect.y - c.y)
		)
		.slice(0, MAX_CANDIDATES);
	const candidates: Rect[] = items.map((i) => i.rect);
	const frames = items.map((i) => i.el).filter((el): el is FrameElement => el.type === 'frame');
	/**
	 * Equal gaps only count between siblings: the elements of the frame the box is over (or the
	 * top-level ones), like the frame it would join when dropped. Otherwise a frame's title or its
	 * neighbours would set the spacing of the cards inside it.
	 */
	const siblingsAt = (rect: Rect): Rect[] => {
		const parent = frameFor(rect, frames);
		return items
			.filter((i) => (i.el.parentId ?? null) === parent && i.el.id !== parent)
			.map((i) => i.rect);
	};
	const threshold = () => THRESHOLD_PX / ctx.viewport.zoom;
	const grid = () => ctx.prefs.snapToGrid;

	const show = (guides: Guide[], gaps: GapMark[] = []) => {
		ctx.preview.guides = guides;
		ctx.preview.gaps = gaps;
	};

	return {
		/** Correction to apply to a moving box (already offset by the raw drag). */
		move(rect: Rect, disabled: boolean): { dx: number; dy: number } {
			if (disabled) {
				show([]);
				return { dx: 0, dy: 0 };
			}
			const r = snapMoveEqual(rect, candidates, threshold(), siblingsAt(rect));
			let { dx, dy } = r;
			if (grid()) {
				if (!r.snappedX) dx = snapToGrid(rect.x, GRID_SIZE) - rect.x;
				if (!r.snappedY) dy = snapToGrid(rect.y, GRID_SIZE) - rect.y;
			}
			show(r.guides, r.gaps);
			return { dx, dy };
		},
		/** A dragged point (resize handle, drawing corner) snapped to guides/grid. */
		point(p: Point, disabled: boolean): Point {
			if (disabled) {
				show([]);
				return p;
			}
			const r = snapPoint(p, candidates, threshold());
			const out = { ...r.point };
			if (grid()) {
				if (!r.snappedX) out.x = snapToGrid(p.x, GRID_SIZE);
				if (!r.snappedY) out.y = snapToGrid(p.y, GRID_SIZE);
			}
			show(r.guides);
			return out;
		},
		clear(): void {
			show([]);
		}
	};
}

export type Snapper = ReturnType<typeof createSnapper>;
