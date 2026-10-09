// The link between open boards and the sync engine. Kept tiny and engine-free so `openBoard` and
// the image cache can talk to sync without loading it; the engine (in the leader tab) listens here.
import type * as Y from 'yjs';
import { nanoid } from 'nanoid';
import { REMOTE_SYNC, REMOTE_TAB } from '$lib/model/origins';

type Message =
	| { type: 'dirty'; board: string }
	| { type: 'asset-request'; asset: string; req: string }
	/** The syncing tab got the request (no answer: sync is off). */
	| { type: 'asset-ack'; req: string }
	| { type: 'asset-done'; req: string; ok: boolean };

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
 * Asks the syncing tab to download an image missing here. Resolves true once it's stored locally;
 * false when sync is off (no answer within `ackMs`), the image isn't on the remote, or `totalMs`
 * passes.
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
		/** Sync is on and fetching it. */ onAck?: () => void;
	} = {}
): Promise<boolean> {
	const req = nanoid(8);
	return new Promise((resolve) => {
		const finish = (ok: boolean) => {
			off();
			clearTimeout(noAck);
			clearTimeout(tooLong);
			resolve(ok);
		};
		const off = listen((msg) => {
			if (msg.type === 'asset-ack' && msg.req === req) {
				clearTimeout(noAck);
				onAck?.();
			}
			if (msg.type === 'asset-done' && msg.req === req) finish(msg.ok);
		});
		const noAck = setTimeout(() => finish(false), ackMs);
		const tooLong = setTimeout(() => finish(false), totalMs);
		send({ type: 'asset-request', asset, req });
	});
}

/** The syncing tab answers image requests with `fetch`. */
export function serveAssetRequests(fetch: (asset: string) => Promise<boolean>): () => void {
	return listen((msg) => {
		if (msg.type !== 'asset-request') return;
		send({ type: 'asset-ack', req: msg.req });
		void fetch(msg.asset)
			.catch(() => false)
			.then((ok) => send({ type: 'asset-done', req: msg.req, ok }));
	});
}
