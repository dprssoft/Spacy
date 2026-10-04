import * as Y from 'yjs';
import { copyThreadsTo, parseThreads, threadsOn, type CommentThread } from '$lib/model/comments';
import { cloneElements } from '$lib/model/clone';
import { DEFAULT_SIZES, FONT_SIZE_PX, LINE_HEIGHT, newElementBase } from '$lib/model/defaults';
import { getDocsMap } from '$lib/model/doc';
import { rawStrokes } from '../sketch/data';
import { newId } from '$lib/model/ids';
import { createElements } from '$lib/model/ops';
import { parseElement } from '$lib/model/schema';
import type { Element, Point } from '$lib/model/types';
import { base64ToBytes, bytesToBase64 } from '$lib/shared/base64';
import * as assetsRepo from '$lib/storage/assetsRepo';
import type { BoardContext } from '../context';
import { createMedia, mediaLinkIn } from '../media/createMedia';
import { rectCenter, rectsIntersect, unionRects } from '../engine/geometry';
import { visibleWorldRect } from '../engine/viewport';
import { getDefaultStyle } from '../style/styleDefaults';
import { syncFrameMembership, withFrameChildren } from '../frameMembership';
import { createWithContent, deleteSelection, selectedElements } from './edit';

export const CLIPBOARD_PREFIX = 'SMTHNG-CLIPBOARD:';
const PASTE_STEP = 16;

export interface ClipPayload {
	smthng: 1;
	sourceBoardId: string;
	elements: Element[];
	/** base64 Yjs update of a doc whose `docs` map holds the copied doc cards' contents. */
	docs: string;
	/** Brush strokes of copied sketches, by element id. */
	sketches?: Record<string, unknown[]>;
	/** Comment threads on the copied elements (and on text in copied doc cards). */
	comments?: CommentThread[];
}

/** Last copy made in this tab; used when the system clipboard is unavailable. */
let memory: string | null = null;
/** Repeated pastes of the same copy cascade instead of stacking on top of each other. */
let lastPaste = { text: '', count: 0 };

export function serializeElements(ctx: BoardContext, els: readonly Element[]): string {
	const temp = new Y.Doc();
	const docs = getDocsMap(ctx.doc);
	const tempDocs = getDocsMap(temp);
	for (const el of els) {
		const frag = el.type === 'doccard' ? docs.get(el.id) : undefined;
		if (frag) tempDocs.set(el.id, frag.clone());
	}
	const sketches: Record<string, unknown[]> = {};
	for (const el of els) if (el.type === 'sketch') sketches[el.id] = rawStrokes(ctx.doc, el.id);
	const payload: ClipPayload = {
		smthng: 1,
		sourceBoardId: ctx.id,
		elements: [...els],
		docs: bytesToBase64(Y.encodeStateAsUpdate(temp)),
		sketches,
		comments: threadsOn(ctx.doc, new Set(els.map((e) => e.id)))
	};
	temp.destroy();
	return CLIPBOARD_PREFIX + JSON.stringify(payload);
}

/** Parses clipboard text; null if it isn't a (valid) SMTHNG payload. */
export function parsePayload(text: string): ClipPayload | null {
	if (!text.startsWith(CLIPBOARD_PREFIX)) return null;
	try {
		const raw = JSON.parse(text.slice(CLIPBOARD_PREFIX.length)) as Partial<ClipPayload>;
		if (raw.smthng !== 1 || !Array.isArray(raw.elements) || typeof raw.sourceBoardId !== 'string')
			return null;
		const elements = raw.elements.map(parseElement).filter((e): e is Element => !!e);
		if (elements.length === 0) return null;
		return {
			smthng: 1,
			sourceBoardId: raw.sourceBoardId,
			elements,
			docs: typeof raw.docs === 'string' ? raw.docs : '',
			sketches:
				raw.sketches && typeof raw.sketches === 'object'
					? (raw.sketches as Record<string, unknown[]>)
					: undefined,
			comments: parseThreads(raw.comments)
		};
	} catch {
		return null;
	}
}

/** Text for the clipboard for the current selection, or null if nothing is selected. */
export function copySelectionText(ctx: BoardContext): string | null {
	const els = withFrameChildren(ctx, selectedElements(ctx));
	if (els.length === 0) return null;
	const text = serializeElements(ctx, els);
	memory = text;
	lastPaste = { text: '', count: 0 };
	return text;
}

/** Where pasted content goes when it isn't cascading: the pointer if on screen, else the view center. */
export function pasteAnchor(ctx: BoardContext): Point {
	const view = visibleWorldRect(ctx.viewport.vp, ctx.viewport.size);
	const p = ctx.pointer;
	if (p && p.x >= view.x && p.y >= view.y && p.x <= view.x + view.w && p.y <= view.y + view.h)
		return p;
	return rectCenter(view);
}

/** Copies image assets from another board into this one; returns old → new asset ids. */
async function importAssets(ctx: BoardContext, payload: ClipPayload): Promise<Map<string, string>> {
	const map = new Map<string, string>();
	if (payload.sourceBoardId === ctx.id) return map;
	for (const el of payload.elements) {
		if (el.type !== 'image' || map.has(el.assetId)) continue;
		const record = await assetsRepo.get(el.assetId);
		if (!record) continue;
		map.set(
			el.assetId,
			await assetsRepo.put(ctx.id, record.blob, { width: record.width, height: record.height })
		);
	}
	return map;
}

/** Pastes a payload as new elements (one undo step) and selects them. Returns the new ids. */
export async function pastePayload(
	ctx: BoardContext,
	payload: ClipPayload,
	text: string
): Promise<string[]> {
	const els = payload.elements;
	const bounds = unionRects(els.map((e) => ({ x: e.x, y: e.y, w: e.w, h: e.h })))!;

	lastPaste = lastPaste.text === text ? { text, count: lastPaste.count + 1 } : { text, count: 1 };
	const view = visibleWorldRect(ctx.viewport.vp, ctx.viewport.size);
	const originalsVisible =
		payload.sourceBoardId === ctx.id &&
		els.some((e) => ctx.store.get(e.id) && rectsIntersect(e, view));
	let offset: Point;
	if (originalsVisible) {
		offset = { x: PASTE_STEP * lastPaste.count, y: PASTE_STEP * lastPaste.count };
	} else {
		const anchor = pasteAnchor(ctx);
		const c = rectCenter(bounds);
		const cascade = PASTE_STEP * (lastPaste.count - 1);
		offset = { x: anchor.x - c.x + cascade, y: anchor.y - c.y + cascade };
	}

	const assets = await importAssets(ctx, payload);
	const { elements, idMap } = cloneElements(els, { offset });
	const remapped = elements.map((e) =>
		e.type === 'image' && assets.has(e.assetId) ? { ...e, assetId: assets.get(e.assetId)! } : e
	);

	const fragments = new Map<string, Y.XmlFragment>();
	if (payload.docs) {
		const temp = new Y.Doc();
		Y.applyUpdate(temp, base64ToBytes(payload.docs));
		for (const [oldId, frag] of getDocsMap(temp)) {
			const id = idMap.get(oldId);
			if (id) fragments.set(id, frag);
		}
	}

	const sketches = new Map<string, readonly unknown[]>();
	for (const [oldId, strokes] of Object.entries(payload.sketches ?? {})) {
		const id = idMap.get(oldId);
		if (id && Array.isArray(strokes)) sketches.set(id, strokes);
	}

	ctx.undo.stopCapturing();
	const created = createWithContent(ctx, remapped, fragments, sketches, () =>
		copyThreadsTo(ctx.doc, payload.comments ?? [], idMap, ctx.pages.current)
	);
	ctx.undo.stopCapturing();
	ctx.tools.setTool('select');
	ctx.selection.set(created.map((e) => e.id));
	return created.map((e) => e.id);
}

/** Pastes plain text as a text element at the paste anchor. */
export function pastePlainText(ctx: BoardContext, text: string): string | null {
	const value = text.replace(/\r\n?/g, '\n').trimEnd();
	if (!value.trim()) return null;
	const lines = value.split('\n');
	const size = FONT_SIZE_PX.m;
	const w = Math.max(DEFAULT_SIZES.text.w, Math.max(...lines.map((l) => l.length)) * size * 0.6);
	const h = Math.ceil(lines.length * size * LINE_HEIGHT);
	const at = pasteAnchor(ctx);
	const id = newId();
	ctx.undo.stopCapturing();
	const [created] = createElements(ctx.doc, [
		{
			...newElementBase('text', id, at, getDefaultStyle('text')),
			x: at.x - w / 2,
			y: at.y - h / 2,
			w,
			h,
			type: 'text',
			text: value,
			autoWidth: true
		}
	]);
	if (created) syncFrameMembership(ctx, [created.id]);
	ctx.undo.stopCapturing();
	ctx.tools.setTool('select');
	ctx.selection.set([id]);
	return id;
}

/** Image files pasted or dropped onto the board. Installed by the image feature (step 15). */
export const imagePaste: {
	handler: ((ctx: BoardContext, files: File[], at: Point) => Promise<unknown>) | null;
} = { handler: null };

/** Handles clipboard text (a payload, a media link, or plain text). */
export async function pasteText(ctx: BoardContext, text: string): Promise<void> {
	const payload = parsePayload(text);
	const media = payload ? null : mediaLinkIn(text);
	if (payload) await pastePayload(ctx, payload, text);
	else if (media) createMedia(ctx, media, pasteAnchor(ctx));
	else pastePlainText(ctx, text);
}

// --- Browser clipboard plumbing ---------------------------------------------------------------

/** For the native `copy`/`cut` events: returns true if the board handled it. */
export function onCopyEvent(ctx: BoardContext, e: ClipboardEvent, cut: boolean): boolean {
	const text = copySelectionText(ctx);
	if (!text || !e.clipboardData) return false;
	e.clipboardData.setData('text/plain', text);
	e.preventDefault();
	if (cut) deleteSelection(ctx);
	return true;
}

/** For the native `paste` event. */
export function onPasteEvent(ctx: BoardContext, e: ClipboardEvent): void {
	const data = e.clipboardData;
	if (!data) return;
	const files = [...data.files].filter((f) => f.type.startsWith('image/'));
	const text = data.getData('text/plain');
	e.preventDefault();
	if (files.length > 0 && !parsePayload(text)) {
		void imagePaste.handler?.(ctx, files, pasteAnchor(ctx));
		return;
	}
	if (text) void pasteText(ctx, text);
}

/** Menu "Copy"/"Cut": the async Clipboard API, with the in-tab copy as a fallback. */
export async function copyToClipboard(ctx: BoardContext, cut = false): Promise<void> {
	const text = copySelectionText(ctx);
	if (!text) return;
	try {
		await navigator.clipboard.writeText(text);
	} catch {
		// Permission denied or unsupported: `memory` still holds the copy for in-app paste.
	}
	if (cut) deleteSelection(ctx);
}

/** Menu "Paste": reads the system clipboard, falling back to the last in-tab copy. */
export async function pasteFromClipboard(ctx: BoardContext): Promise<void> {
	let text: string | null;
	try {
		text = await navigator.clipboard.readText();
	} catch {
		text = memory;
	}
	if (text) await pasteText(ctx, text);
}

export const hasClipboardFallback = (): boolean => memory !== null;
