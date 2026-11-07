import type { Element, ElementType } from '$lib/model/types';

const TYPE_NAMES: Record<ElementType, string> = {
	shape: 'Shape',
	sticky: 'Sticky note',
	text: 'Text',
	image: 'Image',
	stroke: 'Drawing',
	frame: 'Frame',
	doccard: 'Doc card',
	connector: 'Connector',
	sketch: 'Sketch',
	media: 'Media',
	waystone: 'Tab',
	widget: 'Widget',
	table: 'Table'
};

/** A short name for the object a comment is on: its title or first line, else its type. */
export function targetLabel(el: Element): string {
	const own =
		'title' in el && typeof el.title === 'string'
			? el.title
			: el.type === 'waystone'
				? el.name
				: 'text' in el && typeof el.text === 'string'
					? el.text
					: '';
	const line = own.replace(/\s+/g, ' ').trim();
	return line ? line.slice(0, 40) : TYPE_NAMES[el.type];
}
