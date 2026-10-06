// Every localStorage access goes through here: storage can be disabled, full, or hold garbage.
const PREFIX = 'spacy:';

export function getPref<T>(key: string, fallback: T): T {
	try {
		const raw = localStorage.getItem(PREFIX + key);
		return raw === null ? fallback : (JSON.parse(raw) as T);
	} catch {
		return fallback;
	}
}

export function setPref<T>(key: string, value: T): void {
	try {
		localStorage.setItem(PREFIX + key, JSON.stringify(value));
	} catch {
		// Quota exceeded or storage disabled: preferences are best-effort.
	}
}

export function removePref(key: string): void {
	try {
		localStorage.removeItem(PREFIX + key);
	} catch {
		// See setPref.
	}
}
