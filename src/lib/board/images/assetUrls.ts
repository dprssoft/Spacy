import * as assetsRepo from '$lib/storage/assetsRepo';
import { requestAsset } from '$lib/storage/sync/hub';

/** Object URLs for a board's image assets, created once per asset and revoked when the board closes. */
export class AssetUrlCache {
	#urls = new Map<string, Promise<string | null>>();
	/** Assets being downloaded from the user's other devices, with who wants to know. */
	#downloading = new Map<string, Set<() => void>>();

	/** `onDownloading` is called when the image isn't on this device and sync is fetching it. */
	get(assetId: string, onDownloading?: () => void): Promise<string | null> {
		const waiting = this.#downloading.get(assetId);
		if (waiting && onDownloading) {
			waiting.add(onDownloading);
			onDownloading();
		}
		let url = this.#urls.get(assetId);
		if (!url) {
			url = this.#load(assetId, onDownloading).catch(() => null);
			this.#urls.set(assetId, url);
		}
		return url;
	}

	async #load(assetId: string, onDownloading?: () => void): Promise<string | null> {
		let record = await assetsRepo.get(assetId);
		if (!record) {
			const waiting = new Set(onDownloading ? [onDownloading] : []);
			const onAck = () => {
				this.#downloading.set(assetId, waiting);
				for (const fn of waiting) fn();
			};
			try {
				if (await requestAsset(assetId, { onAck })) record = await assetsRepo.get(assetId);
			} finally {
				this.#downloading.delete(assetId);
			}
		}
		return record ? URL.createObjectURL(record.blob) : null;
	}

	revokeAll(): void {
		for (const url of this.#urls.values()) {
			void url.then((u) => u && URL.revokeObjectURL(u));
		}
		this.#urls.clear();
	}
}
