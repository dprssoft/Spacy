// Images between browsers in a live session. Board data carries only asset ids, so a session-only
// Y.Doc (its own provider room) works as a small request board: `wants` lists images someone is
// missing, and whoever has one puts it in `files`. The asker stores it and clears both entries.
import * as Y from 'yjs';
import type { LocalAsset } from '../sync/engine';

export const MAX_LIVE_ASSET_BYTES = 5 * 1024 * 1024;
const WAIT_MS = 30_000;

interface FileEntry {
	mime: string;
	w: number;
	h: number;
	data: Uint8Array;
}

export interface LiveAssetsLocal {
	read(id: string): Promise<LocalAsset | null>;
	write(asset: LocalAsset): Promise<void>;
}

export class LiveAssets {
	private readonly wants: Y.Map<number>;
	private readonly files: Y.Map<FileEntry>;
	private readonly me: string;
	private readonly offering = new Set<string>();

	constructor(
		readonly doc: Y.Doc,
		private readonly boardId: string,
		private readonly local: LiveAssetsLocal
	) {
		this.wants = doc.getMap('wants');
		this.files = doc.getMap('files');
		this.me = String(doc.clientID);
		this.wants.observe(this.onWants);
		this.onWants();
	}

	destroy(): void {
		this.wants.unobserve(this.onWants);
	}

	/** Asks the peers for an image. Resolves true once it's stored locally. */
	request(assetId: string, waitMs = WAIT_MS): Promise<boolean> {
		const key = `${assetId}:${this.me}`;
		return new Promise((resolve) => {
			const check = async () => {
				const f = this.files.get(assetId);
				if (!f) return;
				finish();
				await this.local.write({
					id: assetId,
					boardId: this.boardId,
					blob: new Blob([f.data as BlobPart], { type: f.mime }),
					mime: f.mime,
					width: f.w,
					height: f.h
				});
				this.doc.transact(() => {
					this.wants.delete(key);
					if (!this.othersWant(assetId)) this.files.delete(assetId);
				});
				resolve(true);
			};
			const finish = () => {
				clearTimeout(timer);
				this.files.unobserve(onFiles);
			};
			const onFiles = () => void check().catch(() => resolve(false));
			const timer = setTimeout(() => {
				finish();
				this.wants.delete(key);
				resolve(false);
			}, waitMs);
			this.files.observe(onFiles);
			this.wants.set(key, Date.now());
			onFiles();
		});
	}

	private othersWant(assetId: string): boolean {
		for (const key of this.wants.keys()) {
			if (key.startsWith(`${assetId}:`) && !key.endsWith(`:${this.me}`)) return true;
		}
		return false;
	}

	private readonly onWants = () => {
		for (const key of this.wants.keys()) {
			const [assetId, who] = key.split(':');
			if (!assetId || who === this.me || this.files.has(assetId) || this.offering.has(assetId))
				continue;
			this.offering.add(assetId);
			void this.offer(assetId).finally(() => this.offering.delete(assetId));
		}
	};

	private async offer(assetId: string): Promise<void> {
		const a = await this.local.read(assetId).catch(() => null);
		if (!a || a.blob.size > MAX_LIVE_ASSET_BYTES || this.files.has(assetId)) return;
		const data = new Uint8Array(await a.blob.arrayBuffer());
		this.files.set(assetId, { mime: a.mime, w: a.width, h: a.height, data });
	}
}
