// The link between open boards and the sync engine. Kept tiny and engine-free so `openBoard` can
// report changes without loading sync code; the engine (in the leader tab) listens here.
import type * as Y from 'yjs';
import { REMOTE_SYNC, REMOTE_TAB } from '$lib/model/origins';

type Message = { type: 'dirty'; board: string };

const EVENT = 'dirty';
const local = new EventTarget();
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('spacy-sync') : null;
channel?.addEventListener('message', (e: MessageEvent<Message>) => {
	if (e.data?.type === EVENT) local.dispatchEvent(new CustomEvent(EVENT, { detail: e.data.board }));
});

const openDocs = new Map<string, Y.Doc>();

/** A board changed outside the engine, in this tab or another. */
export function markDirty(board: string): void {
	local.dispatchEvent(new CustomEvent(EVENT, { detail: board }));
	channel?.postMessage({ type: EVENT, board } satisfies Message);
}

export function onDirty(cb: (board: string) => void): () => void {
	const listener = (e: Event) => cb((e as CustomEvent<string>).detail);
	local.addEventListener(EVENT, listener);
	return () => local.removeEventListener(EVENT, listener);
}

/** Registers a board open in this tab, so the engine applies remote changes to it live. */
export function trackOpenBoard(id: string, doc: Y.Doc): () => void {
	openDocs.set(id, doc);
	// Another tab reports its own changes; remote ones are already synced.
	const onUpdate = (_u: Uint8Array, origin: unknown) => {
		if (origin !== REMOTE_SYNC && origin !== REMOTE_TAB) markDirty(id);
	};
	doc.on('update', onUpdate);
	return () => {
		doc.off('update', onUpdate);
		if (openDocs.get(id) === doc) openDocs.delete(id);
	};
}

export function openDoc(id: string): Y.Doc | undefined {
	return openDocs.get(id);
}
