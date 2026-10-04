import * as Y from 'yjs';
import { z } from 'zod';
import { getDocsMap } from './doc';
import { newId } from './ids';
import { beforeDeleteHooks } from './ops';
import { LOCAL, type Origin } from './origins';

// Comment threads (schema version 6): `doc.getMap('comments')` maps a thread id to a Y.Map with
// `anchor`, `page`, `resolved`, `createdAt` (plain values) and `messages` (a Y.Array of plain
// message objects). Text anchors are `comment` marks (threadId) in doc card text.

export type CommentAnchor =
	{ kind: 'element'; elementId: string } | { kind: 'text'; cardId: string };

export interface CommentMessage {
	id: string;
	author: string;
	text: string;
	at: number;
	editedAt?: number;
}

export interface CommentThread {
	id: string;
	anchor: CommentAnchor;
	page: string;
	resolved: boolean;
	createdAt: number;
	messages: CommentMessage[];
}

const anchorSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('element'), elementId: z.string().min(1) }),
	z.object({ kind: z.literal('text'), cardId: z.string().min(1) })
]);
const messageSchema = z.object({
	id: z.string().min(1),
	author: z.string().max(100),
	text: z.string().max(10_000),
	at: z.number(),
	editedAt: z.number().optional()
});

const threadSchema = z.object({
	id: z.string().min(1),
	anchor: anchorSchema,
	page: z.string(),
	resolved: z.boolean(),
	createdAt: z.number(),
	messages: z.array(messageSchema).min(1).max(1000)
});

/** Threads from untrusted JSON (clipboard); invalid ones are dropped. */
export function parseThreads(raw: unknown): CommentThread[] {
	if (!Array.isArray(raw)) return [];
	return raw.flatMap((t) => {
		const r = threadSchema.safeParse(t);
		return r.success ? [r.data] : [];
	});
}

export const getCommentsMap = (doc: Y.Doc): Y.Map<Y.Map<unknown>> => doc.getMap('comments');

export function readThread(id: string, ymap: Y.Map<unknown>): CommentThread | null {
	const anchor = anchorSchema.safeParse(ymap.get('anchor'));
	const messagesY = ymap.get('messages');
	if (!anchor.success || !(messagesY instanceof Y.Array)) return null;
	const messages = (messagesY.toArray() as unknown[]).flatMap((m) => {
		const r = messageSchema.safeParse(m);
		return r.success ? [r.data] : [];
	});
	return {
		id,
		anchor: anchor.data,
		page: typeof ymap.get('page') === 'string' ? (ymap.get('page') as string) : 'main',
		resolved: ymap.get('resolved') === true,
		createdAt: Number(ymap.get('createdAt')) || 0,
		messages
	};
}

export function listThreads(doc: Y.Doc): CommentThread[] {
	const out: CommentThread[] = [];
	for (const [id, ymap] of getCommentsMap(doc)) {
		const t = readThread(id, ymap);
		if (t && t.messages.length > 0) out.push(t);
	}
	return out.sort((a, b) => a.createdAt - b.createdAt);
}

const message = (author: string, text: string): CommentMessage => ({
	id: newId(),
	author: author.trim().slice(0, 100),
	text: text.trim().slice(0, 10_000),
	at: Date.now()
});

/** A new thread with its first message. Returns its id. */
export function createThread(
	doc: Y.Doc,
	input: { anchor: CommentAnchor; page: string; author: string; text: string; id?: string },
	origin: Origin = LOCAL
): string {
	const id = input.id ?? newId();
	doc.transact(() => {
		const t = new Y.Map<unknown>();
		const messages = new Y.Array<unknown>();
		messages.push([message(input.author, input.text)]);
		t.set('anchor', { ...input.anchor });
		t.set('page', input.page);
		t.set('resolved', false);
		t.set('createdAt', Date.now());
		t.set('messages', messages);
		getCommentsMap(doc).set(id, t);
	}, origin);
	return id;
}

/** A copy of a thread (paste/duplicate) anchored elsewhere, messages kept. Returns its id. */
export function copyThread(
	doc: Y.Doc,
	thread: CommentThread,
	anchor: CommentAnchor,
	page: string,
	origin: Origin = LOCAL
): string {
	const id = newId();
	doc.transact(() => {
		const t = new Y.Map<unknown>();
		const messages = new Y.Array<unknown>();
		messages.push(thread.messages.map((m) => ({ ...m })));
		t.set('anchor', { ...anchor });
		t.set('page', page);
		t.set('resolved', thread.resolved);
		t.set('createdAt', Date.now());
		t.set('messages', messages);
		getCommentsMap(doc).set(id, t);
	}, origin);
	return id;
}

const messagesOf = (doc: Y.Doc, threadId: string) => {
	const m = getCommentsMap(doc).get(threadId)?.get('messages');
	return m instanceof Y.Array ? (m as Y.Array<CommentMessage>) : null;
};

export function reply(
	doc: Y.Doc,
	threadId: string,
	author: string,
	text: string,
	origin: Origin = LOCAL
): void {
	doc.transact(() => messagesOf(doc, threadId)?.push([message(author, text)]), origin);
}

export function editMessage(
	doc: Y.Doc,
	threadId: string,
	messageId: string,
	text: string,
	origin: Origin = LOCAL
): void {
	doc.transact(() => {
		const arr = messagesOf(doc, threadId);
		if (!arr) return;
		const i = arr.toArray().findIndex((m) => m.id === messageId);
		if (i < 0) return;
		const next = { ...arr.get(i), text: text.trim().slice(0, 10_000), editedAt: Date.now() };
		arr.delete(i, 1);
		arr.insert(i, [next]);
	}, origin);
}

/** Deletes a message; deleting the last one deletes the thread. */
export function deleteMessage(
	doc: Y.Doc,
	threadId: string,
	messageId: string,
	origin: Origin = LOCAL
): void {
	doc.transact(() => {
		const arr = messagesOf(doc, threadId);
		if (!arr) return;
		const i = arr.toArray().findIndex((m) => m.id === messageId);
		if (i >= 0) arr.delete(i, 1);
		if (arr.length === 0) removeThread(doc, threadId);
	}, origin);
}

export function setResolved(
	doc: Y.Doc,
	threadId: string,
	resolved: boolean,
	origin: Origin = LOCAL
): void {
	doc.transact(() => getCommentsMap(doc).get(threadId)?.set('resolved', resolved), origin);
}

export function deleteThread(doc: Y.Doc, threadId: string, origin: Origin = LOCAL): void {
	doc.transact(() => removeThread(doc, threadId), origin);
}

/** Deletes a thread and, for a text thread, its highlight. Call inside a transaction. */
function removeThread(doc: Y.Doc, threadId: string): void {
	const anchor = anchorSchema.safeParse(getCommentsMap(doc).get(threadId)?.get('anchor'));
	getCommentsMap(doc).delete(threadId);
	if (anchor.success && anchor.data.kind === 'text') {
		const frag = getDocsMap(doc).get(anchor.data.cardId);
		if (frag) remapCommentMarks(frag, (id) => (id === threadId ? null : id));
	}
}

// --- Text marks ----------------------------------------------------------------------------------
// y-tiptap stores a mark that may overlap itself (`excludes: ''`) as the text attribute
// `comment--<8 chars>`; the suffix only keeps overlapping marks apart and is ignored on read.

const COMMENT_ATTR = /^comment(--[a-zA-Z0-9+/=]{8})?$/;

function attrKey(threadId: string): string {
	let h = 2166136261;
	for (let i = 0; i < threadId.length; i++) h = Math.imul(h ^ threadId.charCodeAt(i), 16777619);
	return `comment--${(h >>> 0).toString(36).padStart(8, '0').slice(-8)}`;
}

function eachText(node: Y.XmlFragment | Y.XmlElement, fn: (t: Y.XmlText) => void): void {
	for (const child of node.toArray()) {
		if (child instanceof Y.XmlText) fn(child);
		else if (child instanceof Y.XmlElement) eachText(child, fn);
	}
}

interface TextRun {
	text: Y.XmlText;
	index: number;
	length: number;
	insert: unknown;
	attrs: Record<string, unknown>;
}

function eachRun(frag: Y.XmlFragment, fn: (run: TextRun) => void): void {
	eachText(frag, (text) => {
		let index = 0;
		for (const op of text.toDelta() as {
			insert: unknown;
			attributes?: Record<string, unknown>;
		}[]) {
			const length = typeof op.insert === 'string' ? op.insert.length : 1;
			fn({ text, index, length, insert: op.insert, attrs: op.attributes ?? {} });
			index += length;
		}
	});
}

const threadOf = (value: unknown): string | null =>
	value &&
	typeof value === 'object' &&
	typeof (value as { threadId?: unknown }).threadId === 'string'
		? (value as { threadId: string }).threadId
		: null;

/**
 * Rewrites the thread id of every comment mark in a doc card: `next` returns the new id, or null
 * to remove the mark. Call inside a transaction.
 */
export function remapCommentMarks(
	frag: Y.XmlFragment,
	next: (threadId: string) => string | null
): void {
	const edits: { run: TextRun; patch: Record<string, unknown> }[] = [];
	eachRun(frag, (run) => {
		const patch: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(run.attrs)) {
			const id = COMMENT_ATTR.test(key) ? threadOf(value) : null;
			if (!id) continue;
			const to = next(id);
			if (to === id) continue;
			patch[key] = null;
			if (to) patch[attrKey(to)] = { threadId: to };
		}
		if (Object.keys(patch).length > 0) edits.push({ run, patch });
	});
	for (const { run, patch } of edits) run.text.format(run.index, run.length, patch);
}

/** The commented text of each thread in a doc card (thread id → quote). */
export function commentQuotes(frag: Y.XmlFragment): Map<string, string> {
	// Short-lived lookup, not reactive state.
	const quotes = new Map<string, string>();
	eachRun(frag, (run) => {
		const piece = typeof run.insert === 'string' ? run.insert : ' ';
		for (const [key, value] of Object.entries(run.attrs)) {
			const id = COMMENT_ATTR.test(key) ? threadOf(value) : null;
			if (id) quotes.set(id, (quotes.get(id) ?? '') + piece);
		}
	});
	return quotes;
}

/** Threads anchored to any of these elements (or to text in these doc cards). */
export function threadsOn(doc: Y.Doc, ids: ReadonlySet<string>): CommentThread[] {
	return listThreads(doc).filter((t) =>
		ids.has(t.anchor.kind === 'element' ? t.anchor.elementId : t.anchor.cardId)
	);
}

/**
 * Copies threads onto copies of their elements (paste, duplicate): `idMap` maps old element ids to
 * new ones; comment marks in the copied doc cards are pointed at the copied threads, and marks of
 * threads that weren't copied are removed. Call inside the transaction that creates the copies.
 */
export function copyThreadsTo(
	doc: Y.Doc,
	threads: readonly CommentThread[],
	idMap: ReadonlyMap<string, string>,
	page: string
): void {
	// Short-lived lookup, not reactive state.
	const threadMap = new Map<string, string>();
	for (const t of threads) {
		const target = t.anchor.kind === 'element' ? t.anchor.elementId : t.anchor.cardId;
		const to = idMap.get(target);
		if (!to) continue;
		const anchor: CommentAnchor =
			t.anchor.kind === 'element'
				? { kind: 'element', elementId: to }
				: { kind: 'text', cardId: to };
		threadMap.set(t.id, copyThread(doc, t, anchor, page, LOCAL));
	}
	const docs = getDocsMap(doc);
	for (const to of idMap.values()) {
		const frag = docs.get(to);
		if (frag) remapCommentMarks(frag, (id) => threadMap.get(id) ?? null);
	}
}

/**
 * Deletes the threads whose element (or doc card, for text threads) matches `drop`. Call inside a
 * transaction.
 */
export function deleteThreadsWhere(doc: Y.Doc, drop: (elementId: string) => boolean): void {
	const map = getCommentsMap(doc);
	for (const [id, t] of [...map]) {
		const anchor = anchorSchema.safeParse(t.get('anchor'));
		if (!anchor.success) continue;
		const target = anchor.data.kind === 'element' ? anchor.data.elementId : anchor.data.cardId;
		if (drop(target)) map.delete(id);
	}
}

// Deleting an element deletes its threads (element-anchored, and text threads of a doc card).
beforeDeleteHooks.push((doc, ids) => deleteThreadsWhere(doc, (id) => ids.has(id)));
