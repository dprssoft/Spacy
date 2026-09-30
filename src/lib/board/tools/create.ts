import { DEFAULT_SIZES, newElementBase, STICKY_COLORS } from '$lib/model/defaults';
import { newId } from '$lib/model/ids';
import { createElements } from '$lib/model/ops';
import type { Point, Rect, ShapeKind } from '$lib/model/types';
import type { BoardContext } from '../context';
import { getDefaultStyle } from '../style/styleDefaults';

// Element factories shared by the creation tools (and later quick-create, paste…).

export function createShape(ctx: BoardContext, kind: ShapeKind, rect: Rect): string {
	const id = newId();
	createElements(ctx.doc, [
		{
			...newElementBase('shape', id, { x: 0, y: 0 }, getDefaultStyle('shape')),
			...rect,
			type: 'shape',
			kind,
			text: ''
		}
	]);
	return id;
}

/** A default-sized shape centered on `at`. */
export function createShapeAt(ctx: BoardContext, kind: ShapeKind, at: Point): string {
	const { w, h } = DEFAULT_SIZES.shape;
	return createShape(ctx, kind, { x: at.x - w / 2, y: at.y - h / 2, w, h });
}

export function createSticky(ctx: BoardContext, at: Point): string {
	const id = newId();
	createElements(ctx.doc, [
		{
			...newElementBase('sticky', id, at, getDefaultStyle('sticky')),
			type: 'sticky',
			text: '',
			color: STICKY_COLORS.yellow
		}
	]);
	return id;
}

/** An auto-width text whose first line is vertically centered on `at`, starting at `at.x`. */
export function createText(ctx: BoardContext, at: Point): string {
	const id = newId();
	const { w, h } = DEFAULT_SIZES.text;
	createElements(ctx.doc, [
		{
			...newElementBase('text', id, at, getDefaultStyle('text')),
			x: at.x,
			y: at.y - h / 2,
			w,
			h,
			type: 'text',
			text: '',
			autoWidth: true
		}
	]);
	return id;
}
