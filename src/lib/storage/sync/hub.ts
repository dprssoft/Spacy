// The link between open boards and the sync engine. Kept tiny and engine-free so `openBoard` and
// the image cache can talk to sync without loading it; the engine (in the leader tab) listens here.
import type * as Y from 'yjs';
import { nanoid } from 'nanoid';
import { REMOTE_SYNC, REMOTE_TAB } from '$lib/model/origins';
import type { SyncState } from './status';

type Message =
	| { type: 'dirty'; board: string }
	| { type: 'asset-request'; asset: string; req: string }
	/** A responder got the request (no answer at all: sync and sharing are off). */
	| { type: 'asset-ack'; req: string; from: string }
	| { type: 'asset-done'; req: string; from: string; ok: boolean }
	/** The syncing tab's state, for every tab's indicator. */
	| { type: 'status'; state: SyncState }
	| { type: 'status-request' }
	/** "Sync now" in any tab; the syncing tab runs a cycle. */
	| { type: 'sync-now' };

const local = new EventTarget();
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('spacy-sync') : null;
channel?.addEventListener('message', (e: MessageEvent<Message>) => {
	if (e.data?.type) local.dispatchEvent(new CustomEvent('message', { detail: e.data }));
});

/** Delivers to this tab and every other tab, once each. */
function send(msg: Message): void {
	local.dispatchEvent(new CustomEvent('message', { detail: msg }));
	channel?.postMessage(msg);
}

function listen(cb: (msg: Message) => void): () => void {
	const listener = (e: Event) => cb((e as CustomEvent<Message>).detail);
	local.addEventListener('message', listener);
	return () => local.removeEventListener('message', listener);
}

const openDocs = new Map<string, Y.Doc>();

export function announceStatus(state: SyncState): void {
	send({ type: 'status', state });
}

/** The syncing tab answers tabs that ask for its state, and runs "Sync now" from any tab. */
export function serveStatus(current: () => SyncState, syncNow: () => void): () => void {
	announceStatus(current());
	return listen((msg) => {
		if (msg.type === 'status-request') announceStatus(current());
		if (msg.type === 'sync-now') syncNow();
	});
}

export function requestSyncNow(): void {
	send({ type: 'sync-now' });
}

export function onStatus(cb: (state: SyncState) => void): () => void {
	const off = listen((msg) => {
		if (msg.type === 'status') cb(msg.state);
	});
	send({ type: 'status-request' });
	return off;
}

/** A board changed outside the engine, in this tab or another. */
export function markDirty(board: string): void {
	send({ type: 'dirty', board });
}

export function onDirty(cb: (board: string) => void): () => void {
	return listen((msg) => {
		if (msg.type === 'dirty') cb(msg.board);
	});
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

/**
 * Asks for an image missing here, from whoever can fetch it: the syncing tab (Drive) and a live
 * session on the board. Resolves true once one of them stored it locally; false when nobody
 * answers within `ackMs` (sync and sharing are off), every responder came back empty, or
 * `totalMs` passes.
 */
export function requestAsset(
	asset: string,
	{
		ackMs = 1500,
		totalMs = 60_000,
		onAck
	}: {
		ackMs?: number;
		totalMs?: number;
		/** Someone is fetching it. */ onAck?: () => void;
	} = {}
): Promise<boolean> {
	const req = nanoid(8);
	const acked = new Set<string>();
	const failed = new Set<string>();
	let ackWindowOver = false;
	return new Promise((resolve) => {
		const finish = (ok: boolean) => {
			off();
			clearTimeout(noAck);
			clearTimeout(tooLong);
			resolve(ok);
		};
		const settle = () => {
			if (ackWindowOver && failed.size === acked.size) finish(false);
		};
		const off = listen((msg) => {
			if ((msg.type !== 'asset-ack' && msg.type !== 'asset-done') || msg.req !== req) return;
			if (msg.type === 'asset-ack') {
				if (acked.size === 0) onAck?.();
				acked.add(msg.from);
			} else if (msg.ok) {
				finish(true);
			} else {
				failed.add(msg.from);
				settle();
			}
		});
		const noAck = setTimeout(() => {
			ackWindowOver = true;
			settle();
		}, ackMs);
		const tooLong = setTimeout(() => finish(false), totalMs);
		send({ type: 'asset-request', asset, req });
	});
}

/** Answers image requests with `fetch` (the syncing tab, a live session). */
export function serveAssetRequests(fetch: (asset: string) => Promise<boolean>): () => void {
	const from = nanoid(8);
	return listen((msg) => {
		if (msg.type !== 'asset-request') return;
		send({ type: 'asset-ack', req: msg.req, from });
		void fetch(msg.asset)
			.catch(() => false)
			.then((ok) => send({ type: 'asset-done', req: msg.req, from, ok }));
	});
}
