// Canvas 2D rendering of the board when zoomed far out (see ElementsLayer): thousands of DOM
// nodes are slow to paint, one canvas isn't. Text too small to read is drawn as bars
// ("greeked"), which needs no measuring or layout.
import { fontStack } from '$lib/fonts/catalog';
import {
	DOC_CARD_HEADER_H,
	FONT_FAMILY,
	FONT_SIZE_PX,
	LINE_HEIGHT,
	STICKY_TEXT_COLOR
} from '$lib/model/defaults';
import type { ConnectorElement, Element, Rect, StrokeWidth, Style } from '$lib/model/types';
import { connectorGeometry } from '../diagram/geometry';
import type { DiagramWorld } from '../diagram/endpoints';
import { markerShape, markerSize } from '../diagram/markers';
import { pointAt } from '../diagram/routing';
import { DEFAULT_INK, radiusPx, seeThrough } from '../elements/common';
import { FRAME_TITLE_FONT, FRAME_TITLE_H } from '../elements/frame/geometry';
import { isLineArt, shapePath } from '../elements/shape/paths';
import { sameNumbers, strokeSvgPath } from '../elements/stroke/strokePath';
import type { Viewport } from '../engine/viewport';
import { strokePaint, type SketchStroke } from '../sketch/brushes';
import { PIN_HEAD, PIN_PATH, PIN_W } from '../waystones/pin';
import { wrapText } from './wrapText';

export interface SceneTheme {
	/** What the default dark ink becomes (light in dark mode). */
	ink: string;
	canvasBg: string;
	/** Placeholder for images that aren't loaded. */
	placeholder: string;
}

export interface SceneSources {
	world: DiagramWorld;
	strokes(sketchId: string): readonly SketchStroke[];
	/** A decoded image, or null while it loads (the caller redraws when it arrives). */
	image(assetId: string): CanvasImageSource | null;
}

type Ctx = CanvasRenderingContext2D;

/** Average glyph width relative to the font size, for estimating how text wraps. */
const GLYPH_W = 0.5;
/** Text smaller than this on screen is drawn as bars. */
const MIN_TEXT_PX = 4;
const SKETCH_MAX_SIDE = 512;

/** Caches built paths per element id; an entry is rebuilt when its key changes. */
class Cache<T> {
	#items = new Map<string, { key: string; value: T }>();
	get(id: string, key: string, build: () => T): T {
		const hit = this.#items.get(id);
		if (hit && hit.key === key) return hit.value;
		const value = build();
		this.#items.set(id, { key, value });
		return value;
	}
	/** Drops entries of elements that weren't drawn, once the cache outgrows what's on screen. */
	sweep(live: ReadonlySet<string>): void {
		if (this.#items.size < 2 * live.size + 500) return;
		for (const id of this.#items.keys()) if (!live.has(id)) this.#items.delete(id);
	}
}

export class SceneRenderer {
	#shapes = new Cache<Path2D>();
	#pin: Path2D | null = null;
	#strokes = new Map<string, { points: readonly number[]; width: StrokeWidth; path: Path2D }>();
	#connectors = new Cache<Path2D>();
	#sketches = new Cache<HTMLCanvasElement | null>();
	#lines = new Cache<string[]>();
	#titles = new Cache<string>();
	#drawn = new Set<string>();
	#zoom = 1;

	/**
	 * Draws `elements` (in paint order) over what's on `c`, whose size is the screen size × `dpr`.
	 * `dimmed` elements (being erased) are drawn faded.
	 */
	draw(
		c: Ctx,
		elements: readonly Element[],
		vp: Viewport,
		dpr: number,
		src: SceneSources,
		theme: SceneTheme,
		dimmed: (id: string) => boolean = () => false
	): void {
		const k = vp.zoom * dpr;
		this.#zoom = vp.zoom;
		this.#drawn.clear();
		for (const el of elements) {
			this.#drawn.add(el.id);
			c.setTransform(k, 0, 0, k, vp.x * dpr, vp.y * dpr);
			c.globalAlpha = el.style.opacity * (dimmed(el.id) ? 0.3 : 1);
			if (el.type === 'connector') {
				this.#connector(c, el, src, theme);
				continue;
			}
			c.translate(el.x, el.y);
			if (el.rotation) {
				c.translate(el.w / 2, el.h / 2);
				c.rotate(el.rotation);
				c.translate(-el.w / 2, -el.h / 2);
			}
			this.#box(c, el, src, theme);
		}
		c.globalAlpha = 1;
		for (const cache of [this.#shapes, this.#connectors, this.#sketches, this.#lines, this.#titles])
			cache.sweep(this.#drawn);
		if (this.#strokes.size >= 2 * this.#drawn.size + 500)
			for (const id of this.#strokes.keys()) if (!this.#drawn.has(id)) this.#strokes.delete(id);
	}

	#box(c: Ctx, el: Exclude<Element, ConnectorElement>, src: SceneSources, theme: SceneTheme) {
		const s = el.style;
		const ink = (color: string) => (color.toLowerCase() === DEFAULT_INK ? theme.ink : color);
		switch (el.type) {
			case 'shape': {
				const r = radiusPx(s);
				const path = this.#shapes.get(
					el.id,
					`${el.kind}|${el.w}|${el.h}|${r}|${s.strokeWidth}`,
					() => new Path2D(shapePath(el.kind, el.w, el.h, r, s.strokeWidth / 2))
				);
				if (!isLineArt(el.kind)) fill(c, s, path);
				stroke(c, s, path, ink(s.stroke));
				const color = isLineArt(el.kind) || seeThrough(s) ? ink(s.font.color) : s.font.color;
				this.#text(c, el.id, el.text, s.font, { x: 8, y: 8, w: el.w - 16, h: el.h - 16 }, color);
				return;
			}
			case 'sticky':
				c.fillStyle = el.color;
				c.beginPath();
				c.roundRect(0, 0, el.w, el.h, radiusPx(s));
				c.fill();
				this.#text(
					c,
					el.id,
					el.text,
					s.font,
					{ x: 16, y: 16, w: el.w - 32, h: el.h - 32 },
					STICKY_TEXT_COLOR
				);
				return;
			case 'text':
				this.#text(
					c,
					el.id,
					el.text,
					{ ...s.font, valign: 't' },
					{ x: 0, y: 0, w: el.w, h: el.h },
					ink(s.font.color)
				);
				return;
			case 'image': {
				const img = src.image(el.assetId);
				c.save();
				c.beginPath();
				c.roundRect(0, 0, el.w, el.h, radiusPx(s));
				c.clip();
				if (img) c.drawImage(img, 0, 0, el.w, el.h);
				else {
					c.fillStyle = theme.placeholder;
					c.fillRect(0, 0, el.w, el.h);
				}
				c.restore();
				if (s.stroke !== 'transparent') stroke(c, s, insetRect(el.w, el.h, s), s.stroke);
				return;
			}
			case 'stroke': {
				// Moves give the stroke new (equal) points: compare values, not identity.
				let hit = this.#strokes.get(el.id);
				if (!hit || hit.width !== s.strokeWidth || !sameNumbers(hit.points, el.points)) {
					hit = {
						points: el.points,
						width: s.strokeWidth,
						path: new Path2D(strokeSvgPath(el.points, s.strokeWidth))
					};
					this.#strokes.set(el.id, hit);
				}
				const path = hit.path;
				c.fillStyle = ink(s.stroke);
				c.fill(path);
				return;
			}
			case 'sketch': {
				const strokes = src.strokes(el.id);
				const key = `${el.nw}|${el.nh}|${el.bx}|${el.by}|${theme.ink}|${strokes.length}|${strokeIds(strokes)}`;
				const bitmap = this.#sketches.get(el.id, key, () => sketchBitmap(el, strokes, theme.ink));
				if (bitmap) c.drawImage(bitmap, 0, 0, el.w, el.h);
				return;
			}
			case 'frame': {
				const path = insetRect(el.w, el.h, s);
				fill(c, s, path);
				stroke(c, s, path, s.stroke);
				if (el.title) {
					const max = Math.max(48, el.w);
					this.#line(
						c,
						el.id,
						el.title,
						0,
						-FRAME_TITLE_H / 2,
						max,
						FRAME_TITLE_FONT,
						500,
						theme.ink
					);
				}
				return;
			}
			case 'media': {
				c.fillStyle = s.fill;
				c.beginPath();
				c.roundRect(0, 0, el.w, el.h, radiusPx(s));
				c.fill();
				const audio = el.provider === 'audio';
				const [cx, cy, r] = audio ? [32, el.h / 2, 20] : [el.w / 2, (el.h - 40) / 2, 28];
				const alpha = c.globalAlpha;
				c.globalAlpha = alpha * 0.15;
				c.fillStyle = '#ffffff';
				c.beginPath();
				c.arc(cx, cy, r, 0, Math.PI * 2);
				c.fill();
				c.globalAlpha = alpha;
				c.beginPath();
				c.moveTo(cx - r * 0.3, cy - r * 0.45);
				c.lineTo(cx + r * 0.5, cy);
				c.lineTo(cx - r * 0.3, cy + r * 0.45);
				c.closePath();
				c.fill();
				const x = audio ? 64 : 12;
				const y = audio ? el.h / 2 - 6 : el.h - 34;
				this.#line(c, el.id, el.title, x, y, el.w - x - 12, 14, 500, '#ffffff');
				return;
			}
			case 'waystone': {
				c.fillStyle = s.fill;
				c.fill((this.#pin ??= new Path2D(PIN_PATH)));
				if (el.name) this.#line(c, el.id, el.name, PIN_W + 6, PIN_HEAD.y, 240, 13, 600, theme.ink);
				return;
			}
			case 'doccard': {
				const path = insetRect(el.w, el.h, s);
				fill(c, s, path);
				stroke(c, s, path, s.stroke);
				const size = FONT_SIZE_PX[s.font.size];
				this.#line(
					c,
					el.id,
					el.title,
					40,
					DOC_CARD_HEADER_H / 2,
					el.w - 88,
					size,
					600,
					s.font.color
				);
				if (el.collapsed) return;
				// Like the DOM preview at low zoom: three skeleton lines.
				const lineW = el.w - 32;
				[1, 0.92, 0.6].forEach((f, i) =>
					bar(c, 16, DOC_CARD_HEADER_H + 24 + i * 22, lineW * f, 18, s.font.color, 0.1)
				);
				return;
			}
		}
	}

	/** Wrapped text in `box`: real glyphs while they're big enough to read, bars below that. */
	#text(c: Ctx, id: string, text: string, font: Style['font'], box: Rect, color: string): void {
		if (!text) return;
		const size = FONT_SIZE_PX[font.size];
		const lh = size * LINE_HEIGHT;
		const readable = size * this.#zoom >= MIN_TEXT_PX;
		const css = fontCss(size, font.bold ? 700 : 400, font.italic, fontStack(font.family));
		let lines: (string | number)[];
		if (readable) {
			c.font = css;
			const key = `${css}|${box.w}|${text}`;
			lines = this.#lines.get(id, key, () => wrapText(text, box.w, (t) => c.measureText(t).width));
		} else lines = greekLines(text, box.w, size);
		if (font.valign !== 't') lines = lines.slice(0, Math.max(1, Math.floor(box.h / lh)));
		const total = lines.length * lh;
		const top =
			font.valign === 't'
				? box.y
				: font.valign === 'b'
					? box.y + box.h - total
					: box.y + (box.h - total) / 2;
		if (readable) {
			c.fillStyle = color;
			c.textBaseline = 'middle';
			c.textAlign = font.align === 'l' ? 'left' : font.align === 'r' ? 'right' : 'center';
			const x = font.align === 'l' ? box.x : font.align === 'r' ? box.x + box.w : box.x + box.w / 2;
			lines.forEach((l, i) => c.fillText(String(l), x, top + i * lh + lh / 2));
			return;
		}
		lines.forEach((w, i) => {
			const n = Number(w);
			const x =
				font.align === 'l'
					? box.x
					: font.align === 'r'
						? box.x + box.w - n
						: box.x + (box.w - n) / 2;
			bar(c, x, top + i * lh + lh / 2, n, size, color);
		});
	}

	/** One left-aligned line (a title), cut to `maxW`. */
	#line(
		c: Ctx,
		id: string,
		text: string,
		x: number,
		cy: number,
		maxW: number,
		size: number,
		weight: number,
		color: string
	): void {
		if (size * this.#zoom < MIN_TEXT_PX) {
			bar(c, x, cy, Math.min(maxW, text.length * size * GLYPH_W), size, color);
			return;
		}
		c.font = fontCss(size, weight, false, FONT_FAMILY);
		const shown = this.#titles.get(id, `${c.font}|${maxW}|${text}`, () => {
			if (c.measureText(text).width <= maxW) return text;
			let t = text;
			while (t.length > 1 && c.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
			return `${t}…`;
		});
		c.fillStyle = color;
		c.textBaseline = 'middle';
		c.textAlign = 'left';
		c.fillText(shown, x, cy);
	}

	#connector(c: Ctx, el: ConnectorElement, src: SceneSources, theme: SceneTheme) {
		const s = el.style;
		const g = connectorGeometry(el, src.world);
		const path = this.#connectors.get(el.id, g.d, () => new Path2D(g.d));
		const color = s.stroke.toLowerCase() === DEFAULT_INK ? theme.ink : s.stroke;
		stroke(c, s, path, color);
		const size = markerSize(s.strokeWidth);
		for (const [kind, tip, angle] of [
			[el.markerStart, g.start, g.startAngle],
			[el.markerEnd, g.end, g.endAngle]
		] as const) {
			const m = markerShape(kind, size);
			if (!m) continue;
			c.save();
			c.translate(tip.x, tip.y);
			c.rotate(angle);
			const p = new Path2D(m.d);
			if (!m.open) {
				c.fillStyle = m.filled ? color : theme.canvasBg;
				c.fill(p);
			}
			c.setLineDash([]);
			c.strokeStyle = color;
			c.lineWidth = s.strokeWidth;
			c.lineJoin = 'round';
			c.stroke(p);
			c.restore();
		}
		if (el.label.text) {
			// The label's position only; its text is unreadable at these zooms anyway.
			const fs = FONT_SIZE_PX[s.font.size === 'm' ? 's' : s.font.size];
			const at = pointAt(g.route, el.label.t).p;
			const w = Math.min(200, el.label.text.length * fs * GLYPH_W);
			if (el.label.background) {
				c.fillStyle = theme.canvasBg;
				c.fillRect(at.x - w / 2 - 6, at.y - fs * 0.7, w + 12, fs * 1.4);
			}
			const color = s.font.color === DEFAULT_INK ? theme.ink : s.font.color;
			if (fs * this.#zoom < MIN_TEXT_PX) bar(c, at.x - w / 2, at.y, w, fs, color);
			else {
				c.font = fontCss(fs, 400, false, FONT_FAMILY);
				c.fillStyle = color;
				c.textAlign = 'center';
				c.textBaseline = 'middle';
				const lines = el.label.text.split('\n');
				const lh = fs * LINE_HEIGHT;
				lines.forEach((l, i) => c.fillText(l, at.x, at.y + (i - (lines.length - 1) / 2) * lh));
			}
		}
	}
}

const fontCss = (size: number, weight: number, italic: boolean, family: string) =>
	`${italic ? 'italic ' : ''}${weight} ${size}px ${family}`;

function insetRect(w: number, h: number, s: Style): Path2D {
	const p = new Path2D();
	const sw = s.strokeWidth;
	p.roundRect(sw / 2, sw / 2, Math.max(0, w - sw), Math.max(0, h - sw), radiusPx(s));
	return p;
}

function fill(c: Ctx, s: Style, path: Path2D): void {
	if (s.fillStyle === 'none' || s.fill === 'transparent') return;
	const alpha = c.globalAlpha;
	if (s.fillStyle === 'semi') c.globalAlpha = alpha * 0.25;
	c.fillStyle = s.fill;
	c.fill(path);
	c.globalAlpha = alpha;
}

function stroke(c: Ctx, s: Style, path: Path2D, color: string): void {
	if (s.stroke === 'transparent') return;
	const w = s.strokeWidth;
	c.setLineDash(s.dash === 'dashed' ? [4 * w, 3 * w] : s.dash === 'dotted' ? [0, 2 * w] : []);
	c.strokeStyle = color;
	c.lineWidth = w;
	c.lineCap = 'round';
	c.lineJoin = 'round';
	c.stroke(path);
}

/** A rounded bar standing in for a line of text, vertically centered on `cy`. */
function bar(
	c: Ctx,
	x: number,
	cy: number,
	w: number,
	size: number,
	color: string,
	opacity = 0.45
): void {
	if (w <= 0) return;
	const h = size * 0.55;
	const alpha = c.globalAlpha;
	c.globalAlpha = alpha * opacity;
	c.fillStyle = color;
	c.beginPath();
	c.roundRect(x, cy - h / 2, w, h, h / 2);
	c.fill();
	c.globalAlpha = alpha;
}

/**
 * The line widths `text` would wrap to in a box `maxW` wide, estimated from its length.
 * Exported for tests.
 */
export function greekLines(text: string, maxW: number, size: number): number[] {
	const glyph = size * GLYPH_W;
	const out: number[] = [];
	for (const para of text.split('\n')) {
		let w = para.length * glyph;
		if (!Number.isFinite(maxW) || maxW <= 0) {
			out.push(w);
			continue;
		}
		while (w > maxW) {
			out.push(maxW);
			w -= maxW;
		}
		out.push(w);
	}
	return out;
}

// Stored strokes are immutable and parsed once (sketch/data.ts), so their identity is a key.
const strokeId = new WeakMap<SketchStroke, number>();
let nextStrokeId = 0;
function strokeIds(strokes: readonly SketchStroke[]): string {
	let key = '';
	for (const s of strokes) {
		let id = strokeId.get(s);
		if (id === undefined) strokeId.set(s, (id = nextStrokeId++));
		key += `${id},`;
	}
	return key;
}

/** A small bitmap of a sketch (erasers need their own surface: they erase what's below them). */
function sketchBitmap(
	el: Extract<Element, { type: 'sketch' }>,
	strokes: readonly SketchStroke[],
	inkColor: string
): HTMLCanvasElement | null {
	if (strokes.length === 0 || el.nw <= 0 || el.nh <= 0 || typeof document === 'undefined')
		return null;
	const scale = Math.min(1, SKETCH_MAX_SIDE / Math.max(el.nw, el.nh));
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.ceil(el.nw * scale));
	canvas.height = Math.max(1, Math.ceil(el.nh * scale));
	const c = canvas.getContext('2d');
	if (!c) return null;
	c.setTransform(scale, 0, 0, scale, -el.bx * scale, -el.by * scale);
	for (const s of strokes) {
		const p = strokePaint(s);
		const path = new Path2D(p.d);
		c.globalCompositeOperation = p.erase ? 'destination-out' : 'source-over';
		c.globalAlpha = p.erase ? 1 : p.opacity;
		const color = p.color.toLowerCase() === DEFAULT_INK ? inkColor : p.color;
		if (p.mode === 'fill') {
			c.fillStyle = color;
			c.fill(path);
		} else {
			c.strokeStyle = color;
			c.lineWidth = p.width;
			c.lineCap = p.cap;
			c.lineJoin = 'round';
			c.stroke(path);
		}
	}
	return canvas;
}

/** Below this zoom, a crowded view is drawn on a canvas instead of with DOM elements. */
export const SCENE_ZOOM = 0.3;
/** …when at least this many elements are near the view (fewer are cheap enough as DOM). */
export const SCENE_MIN_ELEMENTS = 400;

/**
 * Whether to draw the view on a canvas. The element count has some hysteresis so panning across
 * the threshold doesn't switch back and forth.
 */
export function useSceneCanvas(current: boolean, zoom: number, nearby: number): boolean {
	if (zoom >= SCENE_ZOOM) return false;
	return nearby >= (current ? SCENE_MIN_ELEMENTS * 0.75 : SCENE_MIN_ELEMENTS);
}
