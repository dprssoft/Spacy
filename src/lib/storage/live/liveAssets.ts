// Images between browsers in a live session. Board data carries only asset ids, so a browser
// missing an image asks the room for it ("asset-want"); a peer that has it sends the bytes back
// to that browser alone ("asset-file"), which stores it locally.
import type { LocalAsset } from '../sync/engine';
import type { PeerChannel, PeerRoom } from './peerSync';

export const MAX_LIVE_ASSET_BYTES = 5 * 1024 * 1024;
const WAIT_MS = 30_000;

export interface LiveAssetsLocal {
	read(id: string): Promise<LocalAsset | null>;
	write(asset: LocalAsset): Promise<void>;
}

interface FileMeta {
	id: string;
	mime: string;
	w: number;
	h: number;
}

const isFileMeta = (m: unknown): m is FileMeta => {
	const v = m as Partial<FileMeta> | null;
	return (
		!!v &&
		typeof v.id === 'string' &&
		typeof v.mime === 'string' &&
		typeof v.w === 'number' &&
		typeof v.h === 'number'
	);
};

export class LiveAssets {
	private readonly want: PeerChannel<string>;
	private readonly file: PeerChannel<ArrayBuffer>;
	private readonly waiting = new Map<
		string,
		Set<(f: { data: ArrayBuffer; meta: FileMeta }) => void>
	>();

	constructor(
		private readonly room: PeerRoom,
		private readonly boardId: string,
		private readonly local: LiveAssetsLocal
	) {
		this.want = room.makeAction<string>('asset-want');
		this.file = room.makeAction<ArrayBuffer>('asset-file');
		this.want.onMessage = (id, { peerId }) => void this.offer(id, peerId).catch(() => {});
		this.file.onMessage = (data, { metadata }) => {
			if (!isFileMeta(metadata) || data.byteLength > MAX_LIVE_ASSET_BYTES) return;
			for (const fn of this.waiting.get(metadata.id) ?? []) fn({ data, meta: metadata });
		};
	}

	destroy(): void {
		this.want.onMessage = null;
		this.file.onMessage = null;
		this.waiting.clear();
	}

	/** Asks the peers for an image. Resolves true once it's stored locally. */
	request(assetId: string, waitMs = WAIT_MS): Promise<boolean> {
		if (Object.keys(this.room.getPeers()).length === 0) return Promise.resolve(false);
		return new Promise((resolve) => {
			const set = this.waiting.get(assetId) ?? new Set();
			this.waiting.set(assetId, set);
			const done = (ok: boolean) => {
				clearTimeout(timer);
				set.delete(onFile);
				if (set.size === 0) this.waiting.delete(assetId);
				resolve(ok);
			};
			const onFile = ({ data, meta }: { data: ArrayBuffer; meta: FileMeta }) => {
				// Several peers may answer; the first one wins.
				if (!set.has(onFile)) return;
				set.delete(onFile);
				void this.local
					.write({
						id: assetId,
						boardId: this.boardId,
						blob: new Blob([data], { type: meta.mime }),
						mime: meta.mime,
						width: meta.w,
						height: meta.h
					})
					.then(
						() => done(true),
						() => done(false)
					);
			};
			const timer = setTimeout(() => done(false), waitMs);
			set.add(onFile);
			void this.want.send(assetId);
		});
	}

	private async offer(assetId: string, peerId: string): Promise<void> {
		const a = await this.local.read(assetId);
		if (!a || a.blob.size > MAX_LIVE_ASSET_BYTES) return;
		const meta: FileMeta = { id: assetId, mime: a.mime, w: a.width, h: a.height };
		await this.file.send(await a.blob.arrayBuffer(), {
			target: peerId,
			metadata: { ...meta }
		});
	}
}
