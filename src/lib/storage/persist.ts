let requested: Promise<boolean> | null = null;

/**
 * Asks the browser not to evict our data under storage pressure. Once per session unless `again`
 * (an explicit user request); never throws.
 */
export function requestPersistentStorage(again = false): Promise<boolean> {
	if (again) requested = null;
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
