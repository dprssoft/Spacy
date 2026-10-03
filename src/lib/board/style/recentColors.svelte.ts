import { getPref, setPref } from '$lib/shared/localPrefs';
import { normalizeHex } from './palette';

const KEY = 'recentColors';
const MAX = 10;

/** Custom colors picked lately in this browser, newest first (offered in every color picker). */
class RecentColors {
	list = $state<string[]>(read());

	add(color: string): void {
		const hex = normalizeHex(color);
		if (!hex) return;
		this.list = [hex, ...this.list.filter((c) => c !== hex)].slice(0, MAX);
		setPref(KEY, this.list);
	}
}

function read(): string[] {
	const stored: unknown = getPref<unknown>(KEY, []);
	if (!Array.isArray(stored)) return [];
	return stored
		.map((c) => (typeof c === 'string' ? normalizeHex(c) : null))
		.filter((c): c is string => c !== null)
		.slice(0, MAX);
}

export const recentColors = new RecentColors();
