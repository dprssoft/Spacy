let requested: Promise<boolean> | null = null;

/** Asks the browser not to evict our data under storage pressure. Once per session; never throws. */
export function requestPersistentStorage(): Promise<boolean> {
	requested ??= (async () => {
		try {
			if (await navigator.storage?.persisted?.()) return true;
			return (await navigator.storage?.persist?.()) ?? false;
		} catch {
			return false;
		}
	})();
	return requested;
}

export async function storageEstimate(): Promise<{
	usage: number;
	quota: number;
	persisted: boolean;
} | null> {
	try {
		if (!navigator.storage?.estimate) return null;
		const [estimate, persisted] = await Promise.all([
			navigator.storage.estimate(),
			navigator.storage.persisted?.() ?? Promise.resolve(false)
		]);
		return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0, persisted };
	} catch {
		return null;
	}
}
