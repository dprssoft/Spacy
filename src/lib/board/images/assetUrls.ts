import * as assetsRepo from '$lib/storage/assetsRepo';

/** Object URLs for a board's image assets, created once per asset and revoked when the board closes. */
export class AssetUrlCache {
	#urls = new Map<string, Promise<string | null>>();

	get(assetId: string): Promise<string | null> {
		let url = this.#urls.get(assetId);
		if (!url) {
			url = assetsRepo
				.get(assetId)
				.then((record) => (record ? URL.createObjectURL(record.blob) : null))
				.catch(() => null);
			this.#urls.set(assetId, url);
		}
		return url;
	}

	revokeAll(): void {
		for (const url of this.#urls.values()) {
			void url.then((u) => u && URL.revokeObjectURL(u));
		}
		this.#urls.clear();
	}
}
