import { baseStyleFor } from '$lib/model/defaults';
import { newId } from '$lib/model/ids';
import { createElements } from '$lib/model/ops';
import { TEMPLATE } from '$lib/model/origins';
import type {
	ConnectorElement,
	DocCardElement,
	Element,
	FrameElement,
	Marker,
	NewElement,
	Port,
	Rect,
	Routing,
	ShapeElement,
	ShapeKind,
	StickyElement,
	Style,
	TextElement
} from '$lib/model/types';
import { connectableFor } from '$lib/board/elements/connectables';
import type * as Y from 'yjs';

type StylePatch = Partial<Omit<Style, 'font'>> & { font?: Partial<Style['font']> };
type New<E extends Element> = Omit<E, 'z'>;

const styled = (type: Element['type'], patch: StylePatch = {}): Style => {
	const base = baseStyleFor(type);
	return { ...base, ...patch, font: { ...base.font, ...patch.font } };
};

/** Frame tints: a pastel at 25 % (readable in light and dark), outlined in a deeper shade. */
export const TINTS = {
	green: { fill: '#8ce99a', stroke: '#40c057' },
	red: { fill: '#ffa8a8', stroke: '#fa5252' },
	blue: { fill: '#74c0fc', stroke: '#228be6' },
	yellow: { fill: '#ffe066', stroke: '#fab005' },
	violet: { fill: '#b197fc', stroke: '#7950f2' },
	orange: { fill: '#ffc078', stroke: '#fd7e14' },
	teal: { fill: '#63e6be', stroke: '#12b886' },
	gray: { fill: '#dee2e6', stroke: '#868e96' }
} as const;
export type Tint = keyof typeof TINTS;

function tintStyle(tint: string | undefined): StylePatch {
	const t = tint ? TINTS[tint as Tint] : undefined;
	return t ? { fill: t.fill, fillStyle: 'semi', stroke: t.stroke } : {};
}

/** Collects template elements (ids, styles, parents) and writes them in one TEMPLATE transaction. */
export class TemplateBuilder {
	readonly elements: NewElement[] = [];

	#base(type: Element['type'], r: Rect, style: Style, parent?: { id: string }) {
		return {
			id: newId(),
			x: r.x,
			y: r.y,
			w: r.w,
			h: r.h,
			rotation: 0,
			parentId: parent?.id ?? null,
			groupId: null,
			locked: false,
			style
		};
	}

	#add<E extends Element>(el: New<E>): New<E> {
		this.elements.push(el as unknown as NewElement); // New<E> of a union member is a NewElement
		return el;
	}

	frame(title: string, r: Rect, style: StylePatch = {}): New<FrameElement> {
		return this.#add({ ...this.#base('frame', r, styled('frame', style)), type: 'frame', title });
	}

	/** Frames side by side (`cols` per row), each `size`, `gap` apart, starting at `at`. */
	frameGrid(
		titles: readonly string[],
		at: { x: number; y: number },
		size: { w: number; h: number },
		opts: { gap?: number; cols?: number; tints?: readonly string[] } = {}
	): New<FrameElement>[] {
		const gap = opts.gap ?? 40;
		const cols = opts.cols ?? titles.length;
		return titles.map((title, i) =>
			this.frame(
				title,
				{
					x: at.x + (i % cols) * (size.w + gap),
					y: at.y + Math.floor(i / cols) * (size.h + gap),
					...size
				},
				tintStyle(opts.tints?.[i % opts.tints.length])
			)
		);
	}

	shape(
		kind: ShapeKind,
		r: Rect,
		text: string,
		opts: { style?: StylePatch; parent?: { id: string } } = {}
	): New<ShapeElement> {
		return this.#add({
			...this.#base('shape', r, styled('shape', opts.style), opts.parent),
			type: 'shape',
			kind,
			text
		});
	}

	sticky(r: Rect, text: string, color: string, parent?: { id: string }): New<StickyElement> {
		return this.#add({
			...this.#base('sticky', r, styled('sticky'), parent),
			type: 'sticky',
			text,
			color
		});
	}

	text(r: Rect, text: string, style: StylePatch = {}, parent?: { id: string }): New<TextElement> {
		return this.#add({
			...this.#base('text', r, styled('text', style), parent),
			type: 'text',
			text,
			autoWidth: false
		});
	}

	docCard(r: Rect, title: string, parent?: { id: string }): New<DocCardElement> {
		return this.#add({
			...this.#base('doccard', r, styled('doccard'), parent),
			type: 'doccard',
			title,
			collapsed: false,
			expandedH: r.h
		});
	}

	/** A connector between two elements' ports, or floating ends ('float'). */
	connect(
		from: NewElement,
		fromPort: Port | 'float',
		to: NewElement,
		toPort: Port | 'float',
		opts: { routing?: Routing; label?: string; markerStart?: Marker; markerEnd?: Marker } = {}
	): New<ConnectorElement> {
		const end = (el: NewElement, port: Port | 'float'): ConnectorElement['from'] => {
			const c = connectableFor(el as Element);
			const p =
				c && port !== 'float'
					? c.ports(el as Element)[port]
					: { x: el.x + el.w / 2, y: el.y + el.h / 2 };
			return port === 'float'
				? { kind: 'float', elementId: el.id, lastX: p.x, lastY: p.y }
				: { kind: 'port', elementId: el.id, port, lastX: p.x, lastY: p.y };
		};
		return this.#add({
			...this.#base('connector', { x: 0, y: 0, w: 0, h: 0 }, styled('connector')),
			type: 'connector',
			from: end(from, fromPort),
			to: end(to, toPort),
			routing: opts.routing ?? 'elbow',
			waypoints: [],
			markerStart: opts.markerStart ?? 'none',
			markerEnd: opts.markerEnd ?? 'arrow',
			label: { text: opts.label ?? '', t: 0.5, background: true }
		});
	}

	commit(doc: Y.Doc): Element[] {
		return createElements(doc, this.elements, TEMPLATE);
	}
}
