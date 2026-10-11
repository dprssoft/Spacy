import { newElementBase } from '$lib/model/defaults';
import { newId } from '$lib/model/ids';
import { createElements } from '$lib/model/ops';
import type { Point } from '$lib/model/types';
import type { BoardContext } from '../context';
import { syncFrameMembership } from '../frameMembership';
import { getDefaultStyle } from '../style/styleDefaults';
import { widgetKind } from './kinds';
import './index';

/** Dragged from the Widgets menu onto the canvas; the data is the kind. */
export const WIDGET_DRAG_TYPE = 'application/x-spacy-widget';

/** A new widget of `kind` at its design size, centred on `at` (one undo step). Null if unknown. */
export function createWidgetAt(ctx: BoardContext, kind: string, at: Point): string | null {
	const def = widgetKind(kind);
	if (!def) return null;
	const id = newId();
	const { w, h } = def.design;
	ctx.undo.stopCapturing();
	createElements(ctx.doc, [
		{
			...newElementBase('widget', id, at, getDefaultStyle('widget')),
			x: at.x - w / 2,
			y: at.y - h / 2,
			w,
			h,
			type: 'widget',
			kind,
			title: '',
			config: def.defaultConfig(),
			state: def.defaultState()
		}
	]);
	syncFrameMembership(ctx, [id]);
	ctx.undo.stopCapturing();
	return id;
}
