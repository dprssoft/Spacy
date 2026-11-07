// Static SVG rendering of board elements (export, thumbnails). Pure: no Svelte, no DOM; text
// measuring, image data and doc card lines are injected. No foreignObject, so the result can be
// drawn to a canvas and opened anywhere.
import {
	DOC_CARD_HEADER_H,
	FONT_FAMILY,
	FONT_SIZE_PX,
	LINE_HEIGHT,
	RADIUS_PX,
	STICKY_TEXT_COLOR
} from '$lib/model/defaults';
import type { ConnectorElement, Element, Rect, Style } from '$lib/model/types';
import { fontStack } from '$lib/fonts/catalog';
import { connectorGeometry } from '../diagram/geometry';
import { markerShape, markerSize, markerTransform } from '../diagram/markers';
import { pointAt } from '../diagram/routing';
import { dashArray, fillColor } from '../elements/common';
import { pureWorld } from '../elements/connectables';
import { FRAME_TITLE_FONT, FRAME_TITLE_H } from '../elements/frame/geometry';
import { isLineArt, shapePath } from '../elements/shape/paths';
import { strokeSvgPath } from '../elements/stroke/strokePath';
import { strokePaint, type SketchStroke } from '../sketch/brushes';
import { expandRect } from '../engine/geometry';
import { posterSubtitle } from '../media/poster';
import { PIN_HEAD, PIN_PATH, PIN_W } from '../waystones/pin';
import { now } from '../widgets/clock';
import { widgetSvg } from '../widgets/face';
import '../widgets';
import { unionBounds } from './bounds';
import { wrapText, type FontSpec } from './wrapText';

export type DocLine = { text: string; kind: 'h' | 'p' | 'li' };

export interface StaticRenderOptions {
	/** Already filtered and in paint order (frames first, then by z). */
	elements: Element[];
	lookup: (id: string) => Element | undefined;
	/** Default: the union of the elements' bounds. */
	bounds?: Rect;
	padding?: number;
	background: 'transparent' | string;
	measure: (text: string, font: FontSpec) => number;
	assetDataUrl: (assetId: string) => Promise<string | null>;
	docLines: (doccardId: string) => Promise<DocLine[]>;
	/** Brush strokes of a sketch element. */
	sketchStrokes?: (sketchId: string) => readonly SketchStroke[];
	/** `@font-face` rules that embed the fonts used, so the file shows them anywhere. */
	fontCss?: string;
}

export interface StaticSvg {
	svg: string;
	width: number;
	height: number;
	/** The world rectangle shown (bounds + padding). */
	viewBox: Rect;
}

const MUTED = '#71717a';
const CARD_BG_FALLBACK = '#ffffff';

export function escapeXml(s: string): string {
	return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A font-family attribute for anything but the document's default font. */
const familyAttr = (stack: string) =>
	stack === FONT_FAMILY ? '' : ` font-family="${escapeXml(stack)}"`;

const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, ''));

export async function renderStaticSvg(o: StaticRenderOptions): Promise<StaticSvg> {
	const world = pureWorld(o.lookup, o.sketchStrokes);
	const padding = o.padding ?? 32;
	const content = o.bounds ?? unionBounds(o.elements, world) ?? { x: 0, y: 0, w: 0, h: 0 };
	const vb = expandRect(content, padding);
	const width = Math.max(1, Math.ceil(vb.w));
	const height = Math.max(1, Math.ceil(vb.h));
	const canvasBg = o.background === 'transparent' ? CARD_BG_FALLBACK : o.background;
	const r = new Renderer(o, world, canvasBg);

	const body: string[] = [];
	for (const el of o.elements) body.push(await r.element(el));

	const bg =
		o.background === 'transparent'
			? ''
			: `<rect x="${n(vb.x)}" y="${n(vb.y)}" width="${n(vb.w)}" height="${n(vb.h)}" fill="${escapeXml(o.background)}"/>`;
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${n(vb.x)} ${n(vb.y)} ${n(vb.w)} ${n(vb.h)}" font-family="${escapeXml(FONT_FAMILY)}">` +
		`<defs>${o.fontCss ? `<style>${o.fontCss}</style>` : ''}<filter id="shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.15"/></filter>${r.defs.join('')}</defs>` +
		bg +
		body.join('') +
		'</svg>';
	return { svg, width, height, viewBox: vb };
}

class Renderer {
	readonly defs: string[] = [];
	#clips = 0;

	constructor(
		private readonly o: StaticRenderOptions,
		private readonly world: ReturnType<typeof pureWorld>,
		private readonly canvasBg: string
	) {}

	async element(el: Element): Promise<string> {
		const inner = await this.inner(el);
		if (el.type === 'connector') return `<g opacity="${n(el.style.opacity)}">${inner}</g>`;
		const deg = (el.rotation * 180) / Math.PI;
		const rotate = deg ? ` rotate(${n(deg)} ${n(el.w / 2)} ${n(el.h / 2)})` : '';
		const filter = el.style.shadow && el.type !== 'stroke' ? ' filter="url(#shadow)"' : '';
		return `<g transform="translate(${n(el.x)} ${n(el.y)})${rotate}" opacity="${n(el.style.opacity)}"${filter}>${inner}</g>`;
	}

	async inner(el: Element): Promise<string> {
		const s = el.style;
		switch (el.type) {
			case 'shape': {
				const d = shapePath(el.kind, el.w, el.h, RADIUS_PX[s.radius], s.strokeWidth / 2);
				const fill = isLineArt(el.kind) ? 'fill="none"' : fillAttrs(s);
				return (
					`<path d="${d}" ${fill} ${strokeAttrs(s)} stroke-linecap="round" stroke-linejoin="round"/>` +
					this.text(el.text, s.font, { x: 8, y: 8, w: el.w - 16, h: el.h - 16 }, s.font.color)
				);
			}
			case 'sticky':
				return (
					`<rect width="${n(el.w)}" height="${n(el.h)}" rx="${RADIUS_PX[s.radius]}" fill="${escapeXml(el.color)}"/>` +
					this.text(
						el.text,
						s.font,
						{ x: 16, y: 16, w: el.w - 32, h: el.h - 32 },
						STICKY_TEXT_COLOR
					)
				);
			case 'text':
				return this.text(
					el.text,
					{ ...s.font, valign: 't' },
					{ x: 0, y: 0, w: el.autoWidth ? Infinity : el.w, h: el.h },
					s.font.color,
					el.autoWidth ? el.w : undefined
				);
			case 'image': {
				const url = await this.o.assetDataUrl(el.assetId);
				const radius = RADIUS_PX[s.radius];
				const clip = radius ? this.clip(0, 0, el.w, el.h, radius) : '';
				const img = url
					? `<image href="${escapeXml(url)}" width="${n(el.w)}" height="${n(el.h)}" preserveAspectRatio="none"${clip}/>`
					: `<rect width="${n(el.w)}" height="${n(el.h)}" rx="${radius}" fill="#e4e4e7"/>`;
				const border =
					s.stroke !== 'transparent'
						? `<rect x="${n(s.strokeWidth / 2)}" y="${n(s.strokeWidth / 2)}" width="${n(Math.max(0, el.w - s.strokeWidth))}" height="${n(Math.max(0, el.h - s.strokeWidth))}" rx="${radius}" fill="none" ${strokeAttrs(s)}/>`
						: '';
				return img + border;
			}
			case 'stroke':
				return `<path d="${strokeSvgPath(el.points, s.strokeWidth)}" fill="${escapeXml(s.stroke)}"/>`;
			case 'sketch':
				return this.sketch(el);
			case 'frame': {
				const title = el.title
					? `<text x="0" y="${n(-FRAME_TITLE_H / 2 + FRAME_TITLE_FONT * 0.35)}" font-size="${FRAME_TITLE_FONT}" font-weight="500" fill="${MUTED}">${escapeXml(this.fit(el.title, FRAME_TITLE_FONT, Math.max(48, el.w)))}</text>`
					: '';
				return (
					`<rect x="${n(s.strokeWidth / 2)}" y="${n(s.strokeWidth / 2)}" width="${n(Math.max(0, el.w - s.strokeWidth))}" height="${n(Math.max(0, el.h - s.strokeWidth))}" rx="${RADIUS_PX[s.radius]}" ${fillAttrs(s)} ${strokeAttrs(s)}/>` +
					title
				);
			}
			case 'doccard':
				return this.docCard(el);
			case 'connector':
				return this.connector(el);
			case 'media':
				return this.media(el);
			case 'waystone':
				return (
					`<path d="${PIN_PATH}" fill="${escapeXml(s.fill)}"/>` +
					(el.name
						? `<text x="${PIN_W + 6}" y="${n(PIN_HEAD.y + 5)}" font-size="13" font-weight="600" fill="${MUTED}">${escapeXml(this.fit(el.name, 13, 240))}</text>`
						: '')
				);
			case 'widget':
				// As it shows at the moment of export (a running timer: the time left now).
				return widgetSvg(el, now());
		}
	}

	/** A media element's poster (exports never play anything). */
	media(el: Extract<Element, { type: 'media' }>): string {
		const r = RADIUS_PX[el.style.radius];
		const card = `<rect width="${n(el.w)}" height="${n(el.h)}" rx="${r}" fill="${escapeXml(el.style.fill)}"/>`;
		const audio = el.provider === 'audio';
		const play = (cx: number, cy: number, rad: number) =>
			`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(rad)}" fill="#ffffff" fill-opacity="0.15"/>` +
			`<path d="M${n(cx - rad * 0.3)} ${n(cy - rad * 0.45)} L${n(cx + rad * 0.5)} ${n(cy)} L${n(cx - rad * 0.3)} ${n(cy + rad * 0.45)} Z" fill="#ffffff"/>`;
		const textX = audio ? 64 : 12;
		const maxW = Math.max(20, el.w - textX - 12);
		const titleY = audio ? el.h / 2 - 2 : el.h - 30;
		const lines =
			`<text x="${textX}" y="${n(titleY)}" font-size="14" font-weight="500" fill="#ffffff">${escapeXml(this.fit(el.title, 14, maxW))}</text>` +
			`<text x="${textX}" y="${n(titleY + 17)}" font-size="12" fill="#ffffff" fill-opacity="0.7">${escapeXml(this.fit(posterSubtitle(el), 12, maxW))}</text>`;
		return card + (audio ? play(32, el.h / 2, 20) : play(el.w / 2, (el.h - 40) / 2, 28)) + lines;
	}

	async docCard(el: Extract<Element, { type: 'doccard' }>): Promise<string> {
		const s = el.style;
		const size = FONT_SIZE_PX[s.font.size];
		const radius = RADIUS_PX[s.radius];
		const color = escapeXml(s.font.color);
		const family = fontStack(s.font.family);
		const card = `<rect x="${n(s.strokeWidth / 2)}" y="${n(s.strokeWidth / 2)}" width="${n(el.w - s.strokeWidth)}" height="${n(el.h - s.strokeWidth)}" rx="${radius}" ${fillAttrs(s)} ${strokeAttrs(s)}/>`;
		const titleX = 12 + 24 + 4;
		const title = `<text x="${titleX}" y="${n(DOC_CARD_HEADER_H / 2 + size * 0.35)}" font-size="${size}" font-weight="600" fill="${color}">${escapeXml(this.fit(el.title, size, el.w - titleX - 48, true))}</text>`;
		if (el.collapsed) return card + title;

		const sep = `<line x1="0" x2="${n(el.w)}" y1="${DOC_CARD_HEADER_H}" y2="${DOC_CARD_HEADER_H}" stroke="${color}" stroke-opacity="0.12"/>`;
		const box = {
			x: 16,
			y: DOC_CARD_HEADER_H + 12,
			w: el.w - 32,
			h: el.h - DOC_CARD_HEADER_H - 12
		};
		const lines: string[] = [];
		let y = box.y;
		for (const line of await this.o.docLines(el.id)) {
			const fs = line.kind === 'h' ? Math.round(size * 1.3) : size;
			const font: FontSpec = { size: fs, bold: line.kind === 'h', family };
			const indent = line.kind === 'li' ? size : 0;
			for (const t of wrapText(line.text, box.w - indent, (x) => this.o.measure(x, font))) {
				const lh = fs * 1.55;
				if (y > box.y + box.h) break;
				lines.push(
					`<text x="${n(box.x + indent)}" y="${n(y + lh / 2 + fs * 0.35)}" font-size="${fs}"${familyAttr(family)}${line.kind === 'h' ? ' font-weight="650"' : ''} fill="${color}">${escapeXml(t)}</text>`
				);
				y += lh;
			}
			y += size * 0.6;
		}
		const clip = this.clip(0, DOC_CARD_HEADER_H, el.w, el.h - DOC_CARD_HEADER_H, 0);
		return card + title + sep + `<g${clip}>${lines.join('')}</g>`;
	}

	/**
	 * A sketch: its strokes in drawing order. An eraser removes what was drawn before it, so each
	 * one wraps everything so far in a mask.
	 */
	sketch(el: Extract<Element, { type: 'sketch' }>): string {
		const strokes = this.o.sketchStrokes?.(el.id) ?? [];
		if (strokes.length === 0 || el.nw <= 0 || el.nh <= 0) return '';
		let body = '';
		for (const stroke of strokes) {
			const p = strokePaint(stroke);
			if (p.erase) {
				if (!body) continue;
				const id = `erase${++this.#clips}`;
				this.defs.push(
					`<mask id="${id}" maskUnits="userSpaceOnUse" x="${n(el.bx)}" y="${n(el.by)}" width="${n(el.nw)}" height="${n(el.nh)}"><rect x="${n(el.bx)}" y="${n(el.by)}" width="${n(el.nw)}" height="${n(el.nh)}" fill="#fff"/><path d="${p.d}" fill="none" stroke="#000" stroke-width="${n(p.width)}" stroke-linecap="round" stroke-linejoin="round"/></mask>`
				);
				body = `<g mask="url(#${id})">${body}</g>`;
				continue;
			}
			const opacity = p.opacity < 1 ? ` opacity="${p.opacity}"` : '';
			body +=
				p.mode === 'fill'
					? `<path d="${p.d}" fill="${escapeXml(p.color)}"${opacity}/>`
					: `<path d="${p.d}" fill="none" stroke="${escapeXml(p.color)}" stroke-width="${n(p.width)}" stroke-linecap="${p.cap}" stroke-linejoin="round"${opacity}/>`;
		}
		const sx = el.w / el.nw;
		const sy = el.h / el.nh;
		// Outside the erasers' masks: erasing a stroke shows the sheet, not a hole in it.
		const sheet =
			fillColor(el.style) === 'transparent'
				? ''
				: `<rect width="${n(el.w)}" height="${n(el.h)}" ${fillAttrs(el.style)}/>`;
		return `${sheet}<g transform="scale(${n(sx)} ${n(sy)}) translate(${n(-el.bx)} ${n(-el.by)})">${body}</g>`;
	}

	connector(el: ConnectorElement): string {
		const s = el.style;
		const g = connectorGeometry(el, this.world);
		const size = markerSize(s.strokeWidth);
		const marker = (kind: ConnectorElement['markerStart'], tip: typeof g.start, angle: number) => {
			const m = markerShape(kind, size);
			if (!m) return '';
			const fill = m.open ? 'none' : m.filled ? escapeXml(s.stroke) : escapeXml(this.canvasBg);
			return `<path d="${m.d}" transform="${markerTransform(tip, angle)}" fill="${fill}" stroke="${escapeXml(s.stroke)}" stroke-width="${s.strokeWidth}" stroke-linejoin="round" stroke-linecap="round"/>`;
		};
		let label = '';
		if (el.label.text) {
			const fs = FONT_SIZE_PX[s.font.size === 'm' ? 's' : s.font.size];
			const font: FontSpec = { size: fs, family: FONT_FAMILY };
			const p = pointAt(g.route, el.label.t).p;
			const lines = el.label.text.split('\n');
			const lh = fs * LINE_HEIGHT;
			const w = Math.max(...lines.map((l) => this.o.measure(l, font)));
			const top = p.y - (lines.length * lh) / 2;
			const bg = el.label.background
				? `<rect x="${n(p.x - w / 2 - 6)}" y="${n(top - 2)}" width="${n(w + 12)}" height="${n(lines.length * lh + 4)}" rx="4" fill="${escapeXml(this.canvasBg)}"/>`
				: '';
			label =
				bg +
				lines
					.map(
						(l, i) =>
							`<text x="${n(p.x)}" y="${n(top + i * lh + lh / 2 + fs * 0.35)}" font-size="${fs}" text-anchor="middle" fill="${escapeXml(s.font.color)}">${escapeXml(l)}</text>`
					)
					.join('');
		}
		return (
			`<path d="${g.d}" fill="none" ${strokeAttrs(s)} stroke-linecap="round" stroke-linejoin="round"/>` +
			marker(el.markerStart, g.start, g.startAngle) +
			marker(el.markerEnd, g.end, g.endAngle) +
			label
		);
	}

	/** Wrapped text lines inside `box` (local coordinates), aligned like the DOM views. */
	text(text: string, font: Style['font'], box: Rect, color: string, autoWidth?: number): string {
		if (!text) return '';
		const size = FONT_SIZE_PX[font.size];
		const family = fontStack(font.family);
		const spec: FontSpec = { size, bold: font.bold, italic: font.italic, family };
		const lines = wrapText(text, box.w, (s) => this.o.measure(s, spec));
		const lh = size * LINE_HEIGHT;
		const total = lines.length * lh;
		const top =
			font.valign === 't'
				? box.y
				: font.valign === 'b'
					? box.y + box.h - total
					: box.y + (box.h - total) / 2;
		const width = Number.isFinite(box.w) ? box.w : (autoWidth ?? 0);
		const [anchor, x] =
			font.align === 'l'
				? ['start', box.x]
				: font.align === 'r'
					? ['end', box.x + width]
					: ['middle', box.x + width / 2];
		const attrs = `font-size="${size}"${familyAttr(family)}${font.bold ? ' font-weight="700"' : ''}${font.italic ? ' font-style="italic"' : ''} fill="${escapeXml(color)}" text-anchor="${anchor}"`;
		return lines
			.map((l, i) =>
				l
					? `<text x="${n(x)}" y="${n(top + i * lh + lh / 2 + size * 0.35)}" ${attrs} xml:space="preserve">${escapeXml(l)}</text>`
					: ''
			)
			.join('');
	}

	/** Truncates a single line with an ellipsis to fit `maxWidth`. */
	fit(text: string, size: number, maxWidth: number, bold = false): string {
		const font: FontSpec = { size, bold, family: FONT_FAMILY };
		if (this.o.measure(text, font) <= maxWidth) return text;
		let t = text;
		while (t.length > 1 && this.o.measure(`${t}…`, font) > maxWidth) t = t.slice(0, -1);
		return `${t}…`;
	}

	/** Adds a rounded clip rectangle to <defs>; returns the clip-path attribute. */
	clip(x: number, y: number, w: number, h: number, r: number): string {
		const id = `clip${++this.#clips}`;
		this.defs.push(
			`<clipPath id="${id}"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${r}"/></clipPath>`
		);
		return ` clip-path="url(#${id})"`;
	}
}

/** Fill as SVG attributes (semi = 25 % of the color, like the canvas's color-mix). */
function fillAttrs(s: Style): string {
	if (s.fillStyle === 'none' || s.fill === 'transparent') return 'fill="none"';
	return s.fillStyle === 'semi'
		? `fill="${escapeXml(s.fill)}" fill-opacity="0.25"`
		: `fill="${escapeXml(s.fill)}"`;
}

function strokeAttrs(s: Style): string {
	if (s.stroke === 'transparent') return 'stroke="none"';
	const dash = dashArray(s.dash, s.strokeWidth);
	return `stroke="${escapeXml(s.stroke)}" stroke-width="${s.strokeWidth}"${dash ? ` stroke-dasharray="${dash}"` : ''}`;
}
