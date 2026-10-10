// A live session on an open board: while `meta.share` is set, the board's Y.Doc is connected to
// everyone else who has it open, peer to peer (y-webrtc, loaded only when needed).
import type { WebrtcProvider } from 'y-webrtc';
import * as Y from 'yjs';
import { getMeta } from '$lib/model/doc';
import { getShare, type ShareInfo } from '$lib/model/share';
import * as assetsRepo from '../assetsRepo';
import { serveAssetRequests } from '../sync/hub';
import { LiveAssets } from './liveAssets';

export type LiveState =
	| { kind: 'off' }
	/** Shared, looking for others. */
	| { kind: 'waiting' }
	| { kind: 'live'; peers: number };

const roomName = (share: ShareInfo) => `spacy-${share.room}`;
// y-webrtc frees a room name only after its provider's teardown settles; a new provider for the
// same room in this tab (reopening the board) must wait for it.
let teardown: Promise<unknown> = Promise.resolve();

export class LiveSession {
	state: LiveState = { kind: 'off' };
	private readonly listeners = new Set<() => void>();
	private current: {
		share: ShareInfo;
		board: WebrtcProvider;
		assetsProvider: WebrtcProvider;
		assets: LiveAssets;
		stopServing: () => void;
	} | null = null;
	private pending: Promise<void> = Promise.resolve();
	private destroyed = false;

	constructor(
		readonly boardId: string,
		readonly doc: Y.Doc,
		private readonly signaling: readonly string[]
	) {
		getMeta(doc).observe(this.onMeta);
		this.onMeta();
	}

	/** The connection's awareness (presence, step 53); null when not shared. */
	get awareness() {
		return this.current?.board.awareness ?? null;
	}

	subscribe(fn: () => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	/** Resolves once the connection matches `meta.share` (tests, the join flow). */
	settled(): Promise<void> {
		return this.pending;
	}

	destroy(): Promise<void> {
		this.destroyed = true;
		getMeta(this.doc).unobserve(this.onMeta);
		this.pending = this.pending.then(() => this.disconnect());
		return this.pending;
	}

	private readonly onMeta = () => {
		const share = getShare(this.doc);
		const now = this.current?.share;
		if (share?.room === now?.room && share?.key === now?.key) return;
		this.pending = this.pending
			.then(async () => {
				await this.disconnect();
				if (share && !this.destroyed) await this.connect(share);
			})
			// Offline with the code not cached, or a relay URL the browser rejects: stay off.
			.catch((err: unknown) => console.error('Live sharing failed to start', err));
	};

	private async connect(share: ShareInfo): Promise<void> {
		const { WebrtcProvider } = await import('y-webrtc');
		await teardown;
		if (this.destroyed || getShare(this.doc)?.room !== share.room) return;
		const opts = { signaling: [...this.signaling], password: share.key, maxConns: 20 };
		const board = new WebrtcProvider(roomName(share), this.doc, opts);
		const assetsDoc = new Y.Doc();
		const assetsProvider = new WebrtcProvider(`${roomName(share)}-assets`, assetsDoc, opts);
		const assets = new LiveAssets(assetsDoc, this.boardId, {
			read: async (id) => (await assetsRepo.get(id)) ?? null,
			write: (a) => assetsRepo.putSynced(a)
		});
		const stopServing = serveAssetRequests(async (id) =>
			this.peers() > 0 ? assets.request(id) : false
		);
		board.on('peers', this.onPeers);
		this.current = { share, board, assetsProvider, assets, stopServing };
		this.onPeers();
	}

	private async disconnect(): Promise<void> {
		const c = this.current;
		if (!c) return;
		this.current = null;
		c.board.off('peers', this.onPeers);
		c.stopServing();
		c.assets.destroy();
		c.assetsProvider.destroy();
		c.assets.doc.destroy();
		c.board.destroy();
		teardown = Promise.all([teardown, c.board.key, c.assetsProvider.key]).then(() => {});
		await teardown;
		this.set({ kind: 'off' });
	}

	private peers(): number {
		const room = this.current?.board.room;
		return room ? room.webrtcConns.size : 0;
	}

	private readonly onPeers = () => {
		const peers = this.peers();
		this.set(peers > 0 ? { kind: 'live', peers } : { kind: 'waiting' });
	};

	private set(state: LiveState): void {
		this.state = state;
		for (const fn of this.listeners) fn();
	}
}
