import { toast } from 'svelte-sonner';
import type { Element } from '$lib/model/types';
import * as assetsRepo from '$lib/storage/assetsRepo';
import { requestAsset } from '$lib/storage/sync/hub';
import type { BoardContext } from '../context';
import { getDocJSON } from '../doccards/docJson';
import { docLines, type DocLine } from '../doccards/docLines';
import { pointInRotatedRect } from '../engine/geometry';
import type { SketchStroke } from '../sketch/brushes';
import { readStrokes } from '../sketch/data';
import { DEFAULT_FONT } from '$lib/fonts/catalog';
import { embeddedFontCss } from '$lib/fonts/embed';
import { loadFonts } from '$lib/fonts/register';
import { renderStaticSvg, type StaticSvg } from './staticSvg';
import { createCanvasMeasurer } from './wrapText';

export type ExportScope = { kind: 'board' } | { kind: 'selection' } | { kind: 'frame'; id: string };
export type ExportBackground = 'transparent' | string;

const MAX_SIDE = 16_384;
const MAX_AREA = 120_000_000; // stays under browsers' canvas area limits

/** The elements of a scope in paint order (frames first, then by z). */
export function scopeElements(ctx: BoardContext, scope: ExportScope): Element[] {
	const { store } = ctx;
	const all = [...store.frameOrder, ...store.order];
	let ids: Set<string>;
	if (scope.kind === 'board') ids = new Set(all);
	else {
		const roots =
			scope.kind === 'frame' ? [scope.id] : [...ctx.selection.ids].filter((id) => store.get(id));
		ids = new Set(roots);
		// Frames bring their contents.
		for (const id of roots)
			if (store.get(id)?.type === 'frame')
				for (const el of store.elements.values()) if (el.parentId === id) ids.add(el.id);
		const frame = scope.kind === 'frame' ? store.get(scope.id) : undefined;
		// Connectors whose both ends are inside: attached to included elements, or free within the frame.
		for (const el of store.elements.values()) {
			if (el.type !== 'connector' || ids.has(el.id)) continue;
			const inside = (end: typeof el.from) =>
				end.kind === 'free'
					? !!frame && pointInRotatedRect({ x: end.x, y: end.y }, frame, 0)
					: ids.has(end.elementId);
			if (inside(el.from) && inside(el.to)) ids.add(el.id);
		}
	}
	return all.filter((id) => ids.has(id)).flatMap((id) => store.get(id) ?? []);
}

/** Renders a scope to SVG. Doc card text is read synchronously before anything is awaited. */
export async function renderScope(
	ctx: BoardContext,
	scope: ExportScope,
	opts: { background: ExportBackground; padding?: number; waystones?: boolean }
): Promise<StaticSvg | null> {
	// Waystones are navigation aids: left out unless asked for.
	const elements = scopeElements(ctx, scope).filter(
		(el) => opts.waystones || el.type !== 'waystone'
	);
	if (elements.length === 0) return null;
	const lines = new Map<string, DocLine[]>();
	for (const el of elements)
		if (el.type === 'doccard') lines.set(el.id, docLines(getDocJSON(ctx, el.id)));
	// Read now, like the doc lines: the document may be closing.
	const strokes = new Map<string, SketchStroke[]>();
	for (const el of elements)
		if (el.type === 'sketch') strokes.set(el.id, readStrokes(ctx.doc, el.id));
	const byId = new Map([...ctx.store.elements].map(([id, el]) => [id, el]));
	// Text is measured in its own font, and the file carries the fonts it uses.
	const fonts = new Set(elements.map((el) => el.style.font.family ?? DEFAULT_FONT));
	const [fontCss] = await Promise.all([embeddedFontCss(fonts), loadFonts(fonts)]);
	const measure = createCanvasMeasurer();
	const assets = new Map<string, Promise<string | null>>();
	return renderStaticSvg({
		elements,
		lookup: (id) => byId.get(id),
		background: opts.background,
		padding: opts.padding,
		measure,
		assetDataUrl: (id) => {
			let p = assets.get(id);
			if (!p) assets.set(id, (p = assetDataUrl(id)));
			return p;
		},
		docLines: async (id) => lines.get(id) ?? [],
		sketchStrokes: (id) => strokes.get(id) ?? [],
		fontCss
	});
}

async function assetDataUrl(id: string): Promise<string | null> {
	let record = await assetsRepo.get(id).catch(() => undefined);
	// Not on this device yet: give sync a moment to bring it before drawing without it.
	if (!record && (await requestAsset(id, { totalMs: 15_000 }))) {
		record = await assetsRepo.get(id).catch(() => undefined);
	}
	return record ? blobToDataUrl(record.blob) : null;
}

function blobToDataUrl(blob: Blob): Promise<string | null> {
	return new Promise((resolve) => {
		const r = new FileReader();
		r.onload = () => resolve(typeof r.result === 'string' ? r.result : null);
		r.onerror = () => resolve(null);
		r.readAsDataURL(blob);
	});
}

export const svgBlob = (svg: string) => new Blob([svg], { type: 'image/svg+xml' });

export async function exportSvg(
	ctx: BoardContext,
	scope: ExportScope,
	background: ExportBackground,
	waystones = false
): Promise<Blob | null> {
	const out = await renderScope(ctx, scope, { background, waystones });
	return out ? svgBlob(out.svg) : null;
}

export async function exportPng(
	ctx: BoardContext,
	scope: ExportScope,
	scale: number,
	background: ExportBackground,
	waystones = false
): Promise<Blob | null> {
	const out = await renderScope(ctx, scope, { background, waystones });
	if (!out) return null;
	const fit = Math.min(
		scale,
		MAX_SIDE / out.width,
		MAX_SIDE / out.height,
		Math.sqrt(MAX_AREA / (out.width * out.height))
	);
	if (fit < scale) toast(`The image is too large: exported at ${Math.round(fit * 100)} % instead.`);
	return rasterize(out.svg, Math.round(out.width * fit), Math.round(out.height * fit), 'image/png');
}

/** Draws an SVG onto a canvas of the given size (stretching the SVG to it). */
export async function rasterize(
	svg: string,
	width: number,
	height: number,
	type: string,
	quality?: number,
	draw?: (c: CanvasRenderingContext2D, img: HTMLImageElement) => void
): Promise<Blob | null> {
	const url = URL.createObjectURL(svgBlob(svg));
	try {
		const img = new Image();
		img.decoding = 'async';
		img.src = url;
		await img.decode();
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, width);
		canvas.height = Math.max(1, height);
		const c = canvas.getContext('2d');
		if (!c) return null;
		if (draw) draw(c, img);
		else c.drawImage(img, 0, 0, canvas.width, canvas.height);
		return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
	} finally {
		URL.revokeObjectURL(url);
	}
}
