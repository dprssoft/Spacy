import { newElementBase } from '$lib/model/defaults';
import { newId } from '$lib/model/ids';
import { createElements } from '$lib/model/ops';
import type { Point } from '$lib/model/types';
import type { BoardContext } from '../context';
import { syncFrameMembership } from '../frameMembership';
import { getDefaultStyle } from '../style/styleDefaults';
import { widgetKind } from './kinds';
import './index';
import { besideSelection, selectedTexts } from './selectionText';
import { segmentsFrom, type WheelConfig } from './wheel/wheel';

/** Dragged from the Widgets menu onto the canvas; the data is the kind. */
export const WIDGET_DRAG_TYPE = 'application/x-spacy-widget';

/** A new widget of `kind` at its design size, centred on `at` (one undo step). Null if unknown. */
export function createWidgetAt(
	ctx: BoardContext,
	kind: string,
	at: Point,
	config?: unknown
): string | null {
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
			config: config ?? def.defaultConfig(),
			state: def.defaultState()
		}
	]);
	syncFrameMembership(ctx, [id]);
	ctx.undo.stopCapturing();
	return id;
}

/** "Make a wheel from selection": a wheel whose segments are the selected texts. */
export function wheelFromSelection(ctx: BoardContext): string | null {
	const labels = selectedTexts(ctx);
	const def = widgetKind('wheel');
	const at = def && besideSelection(ctx, def.design);
	if (!def || !at || labels.length < 2) return null;
	const config = { ...(def.defaultConfig() as WheelConfig), segments: segmentsFrom(labels) };
	const id = createWidgetAt(ctx, 'wheel', at, config);
	if (id) ctx.selection.set([id]);
	return id;
}
