import type { BaseElement, ElementType, FontSize, Point, Style } from './types';

export const PALETTE = [
	'#1e1e1e',
	'#868e96',
	'#e03131',
	'#f76707',
	'#f59f00',
	'#2f9e44',
	'#0c8599',
	'#1971c2',
	'#6741d9',
	'#c2255c',
	'#ffffff',
	'transparent'
] as const;

export const STICKY_COLORS = {
	yellow: '#ffe066',
	orange: '#ffc078',
	pink: '#faa2c1',
	green: '#b2f2bb',
	blue: '#a5d8ff',
	violet: '#d0bfff'
} as const;
export const STICKY_TEXT_COLOR = '#1e1e1e';

export const FONT_FAMILY =
	'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const FONT_SIZE_PX: Record<FontSize, number> = { s: 14, m: 18, l: 24, xl: 36 };
export const LINE_HEIGHT = 1.35;
export const RADIUS_PX: Record<Style['radius'], number> = { none: 0, sm: 8, lg: 20 };

export const DEFAULT_SIZES: Record<ElementType, { w: number; h: number }> = {
	shape: { w: 160, h: 100 },
	sticky: { w: 200, h: 200 },
	text: { w: 20, h: Math.ceil(FONT_SIZE_PX.m * LINE_HEIGHT) },
	image: { w: 0, h: 0 },
	stroke: { w: 0, h: 0 },
	sketch: { w: 0, h: 0 },
	frame: { w: 800, h: 600 },
	doccard: { w: 360, h: 280 },
	connector: { w: 0, h: 0 }
};

export const CONNECTOR_STUB = 20;
export const DOC_CARD_HEADER_H = 40;

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 4;
export const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4] as const;
export const GRID_SIZE = 24;

export const DEFAULT_STYLE: Style = {
	fill: '#ffffff',
	fillStyle: 'solid',
	stroke: '#1e1e1e',
	strokeWidth: 2,
	dash: 'solid',
	radius: 'sm',
	shadow: false,
	opacity: 1,
	font: { size: 'm', bold: false, italic: false, color: '#1e1e1e', align: 'c', valign: 'm' }
};

type StyleTweak = Partial<Omit<Style, 'font'>> & { font?: Partial<Style['font']> };

const TYPE_TWEAKS: Record<ElementType, StyleTweak> = {
	shape: {},
	sticky: { shadow: true, radius: 'sm', stroke: 'transparent', font: { color: STICKY_TEXT_COLOR } },
	text: {
		fill: 'transparent',
		fillStyle: 'none',
		stroke: 'transparent',
		font: { align: 'l', valign: 't' }
	},
	image: { fill: 'transparent', fillStyle: 'none', stroke: 'transparent', radius: 'none' },
	stroke: { fill: 'transparent', fillStyle: 'none' },
	sketch: { fill: 'transparent', fillStyle: 'none', stroke: 'transparent' },
	frame: { fill: '#ffffff', fillStyle: 'semi', stroke: '#868e96', strokeWidth: 1 },
	doccard: {
		fill: '#ffffff',
		stroke: '#e3e3e8',
		strokeWidth: 1,
		radius: 'lg',
		shadow: true,
		font: { align: 'l', valign: 't', size: 's' }
	},
	connector: { fill: 'transparent', fillStyle: 'none' }
};

/** The built-in style for new elements of a type (user defaults are layered on top in step 18). */
export function baseStyleFor(type: ElementType): Style {
	const tweak = TYPE_TWEAKS[type];
	return {
		...DEFAULT_STYLE,
		...tweak,
		font: { ...DEFAULT_STYLE.font, ...tweak.font }
	};
}

/** Base fields for a new element of `type`, default-sized and centered on `at` (no z yet). */
export function newElementBase(
	type: ElementType,
	id: string,
	at: Point,
	style: Style = baseStyleFor(type)
): Omit<BaseElement, 'z'> {
	const { w, h } = DEFAULT_SIZES[type];
	return {
		id,
		type,
		x: at.x - w / 2,
		y: at.y - h / 2,
		w,
		h,
		rotation: 0,
		parentId: null,
		groupId: null,
		locked: false,
		style: structuredClone(style)
	};
}
