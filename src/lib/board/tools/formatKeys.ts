import { isMacPlatform } from './shortcuts';

const MAC: Record<string, string> = { Mod: '⌘', Shift: '⇧', Alt: '⌥' };
const OTHER: Record<string, string> = { Mod: 'Ctrl', Shift: 'Shift', Alt: 'Alt' };
const NAMES: Record<string, string> = {
	Delete: 'Del',
	Backspace: '⌫',
	Escape: 'Esc',
	ArrowLeft: '←',
	ArrowRight: '→',
	ArrowUp: '↑',
	ArrowDown: '↓',
	Enter: '↵'
};

/** Human-readable key combo: 'Mod+Shift+Z' → '⇧⌘Z' on macOS, 'Ctrl+Shift+Z' elsewhere. */
export function formatKeys(combo: string, mac = isMacPlatform()): string {
	const parts = combo.endsWith('++') ? [...combo.slice(0, -2).split('+'), '+'] : combo.split('+');
	const key = parts.pop() ?? '';
	const label = NAMES[key] ?? (key.length === 1 ? key.toUpperCase() : key);
	if (mac) {
		// macOS order: ⌃⌥⇧⌘ then the key, no separators.
		const order = ['Alt', 'Shift', 'Mod'];
		const mods = order.filter((m) => parts.includes(m)).map((m) => MAC[m]);
		return mods.join('') + label;
	}
	return [...parts.map((m) => OTHER[m] ?? m), label].join('+');
}
