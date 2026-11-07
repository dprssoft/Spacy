import { DEFAULT_SIZES, newElementBase, STICKY_COLORS } from '$lib/model/defaults';
import { newId } from '$lib/model/ids';
import { getDocsMap } from '$lib/model/doc';
import { createElements } from '$lib/model/ops';
import { LOCAL } from '$lib/model/origins';
import type { Point, Rect, ShapeKind } from '$lib/model/types';
import type { BoardContext } from '../context';
import { writeDocJSON } from '../doccards/fragmentWrite';
import { getDefaultStyle } from '../style/styleDefaults';
import { newTableJSON } from '../tables/content';

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

/** A default-sized doc card centered on `at`. */
export function createDocCard(ctx: BoardContext, at: Point): string {
	const id = newId();
	const { h } = DEFAULT_SIZES.doccard;
	createElements(ctx.doc, [
		{
			...newElementBase('doccard', id, at, getDefaultStyle('doccard')),
			type: 'doccard',
			title: 'Untitled',
			collapsed: false,
			expandedH: h
		}
	]);
	return id;
}

/** A 3 × 3 table with a header row, centered on `at`; its content is written in the same step. */
export function createTable(ctx: BoardContext, at: Point): string {
	const id = newId();
	ctx.doc.transact(() => {
		createElements(ctx.doc, [
			{ ...newElementBase('table', id, at, getDefaultStyle('table')), type: 'table' }
		]);
		writeDocJSON(getDocsMap(ctx.doc).get(id)!, newTableJSON());
	}, LOCAL);
	return id;
}
