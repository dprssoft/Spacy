// A live session on an open board: while `meta.share` is set, the board's Y.Doc is connected to
// everyone else who has it open, peer to peer (Trystero, loaded only when needed).
import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';
import { getMeta } from '$lib/model/doc';
import { getShare, type ShareInfo } from '$lib/model/share';
import * as assetsRepo from '../assetsRepo';
import { serveAssetRequests } from '../sync/hub';
import { LiveAssets } from './liveAssets';
import { PeerSync } from './peerSync';
import { joinLiveRoom } from './room';

export type LiveState =
	| { kind: 'off' }
	/** Shared, looking for others. */
	| { kind: 'waiting' }
	| { kind: 'live'; peers: number };

export class LiveSession {
	state: LiveState = { kind: 'off' };
	/** The last connection problem (e.g. a network that blocks direct connections), if any. */
	problem: string | null = null;
	private readonly listeners = new Set<() => void>();
	private current: {
		share: ShareInfo;
		sync: PeerSync;
		assets: LiveAssets;
		stop: () => void;
	} | null = null;
	private pending: Promise<void> = Promise.resolve();
	private destroyed = false;

	constructor(
		readonly boardId: string,
		readonly doc: Y.Doc
	) {
		getMeta(doc).observe(this.onMeta);
		this.onMeta();
	}

	/** The connection's awareness (presence, step 53); null when not shared. */
	get awareness(): Awareness | null {
		return this.current?.sync.awareness ?? null;
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
			// Offline with the code not cached, say: stay off.
			.catch((err: unknown) => console.error('Live sharing failed to start', err));
	};

	private async connect(share: ShareInfo): Promise<void> {
		const room = await joinLiveRoom(share.room, share.key, {
			onJoinError: (message) => {
				this.problem = message;
				this.emit();
			}
		});
		if (this.destroyed || getShare(this.doc)?.room !== share.room) {
			await room.leave();
			return;
		}
		const sync = new PeerSync(this.doc, room);
		const assets = new LiveAssets(room, this.boardId, {
			read: async (id) => (await assetsRepo.get(id)) ?? null,
			write: (a) => assetsRepo.putSynced(a)
		});
		const stopServing = serveAssetRequests((id) => assets.request(id));
		const offPeers = sync.subscribe(this.onPeers);
		this.current = {
			share,
			sync,
			assets,
			stop: () => {
				offPeers();
				stopServing();
				assets.destroy();
			}
		};
		this.problem = null;
		this.onPeers();
	}

	private async disconnect(): Promise<void> {
		const c = this.current;
		if (!c) return;
		this.current = null;
		c.stop();
		await c.sync.destroy();
		this.set({ kind: 'off' });
	}

	private readonly onPeers = () => {
		const peers = this.current?.sync.peers ?? 0;
		if (peers > 0) this.problem = null;
		this.set(peers > 0 ? { kind: 'live', peers } : { kind: 'waiting' });
	};

	private set(state: LiveState): void {
		this.state = state;
		this.emit();
	}

	private emit(): void {
		for (const fn of this.listeners) fn();
	}
}
