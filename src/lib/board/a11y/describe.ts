import type { Element } from '$lib/model/types';
import { SHAPE_KINDS } from '../elements/shape/paths';
import type { ToolId } from '../tools/types';

const TYPE_NAMES: Record<Exclude<Element['type'], 'shape'>, string> = {
	sticky: 'sticky note',
	text: 'text',
	image: 'image',
	stroke: 'drawing',
	sketch: 'sketch',
	frame: 'frame',
	doccard: 'doc card',
	connector: 'connector',
	media: 'media',
	waystone: 'waystone'
};

/** A short spoken name: "rectangle", "sticky note", "doc card"… */
export function elementName(el: Element): string {
	if (el.type !== 'shape') return TYPE_NAMES[el.type];
	return (SHAPE_KINDS.find((k) => k.kind === el.kind)?.label ?? 'shape').toLowerCase();
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Rectangle selected", "2 elements selected: rectangle, sticky note", "Selection cleared". */
export function describeSelection(els: readonly Element[]): string {
	if (els.length === 0) return 'Selection cleared';
	if (els.length === 1) return `${capitalize(elementName(els[0]!))} selected`;
	const names = [...new Set(els.map(elementName))];
	const list = names.length > 4 ? `${names.slice(0, 4).join(', ')} and more` : names.join(', ');
	return `${els.length} elements selected: ${list}`;
}

/** "Sticky note created", "3 elements deleted". */
export function describeChange(action: 'created' | 'deleted', els: readonly Element[]): string {
	if (els.length === 0) return '';
	return els.length === 1
		? `${capitalize(elementName(els[0]!))} ${action}`
		: `${els.length} elements ${action}`;
}

const TOOL_NAMES: Record<ToolId, string> = {
	select: 'Select',
	hand: 'Hand',
	pen: 'Pen',
	eraser: 'Eraser',
	sketch: 'Sketch',
	shape: 'Shape',
	connector: 'Connector',
	text: 'Text',
	sticky: 'Sticky note',
	doccard: 'Doc card',
	frame: 'Frame',
	image: 'Image',
	waystone: 'Waystone'
};

export function describeTool(tool: ToolId, shapeLabel?: string): string {
	return `${tool === 'shape' && shapeLabel ? shapeLabel : TOOL_NAMES[tool]} tool`;
}
