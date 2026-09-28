import type { BoardContext } from '../context';

export type ShortcutGroup = 'Tools' | 'Edit' | 'View' | 'Arrange' | 'Diagram' | 'Doc';

export interface Shortcut {
	id: string;
	/** Alternatives, e.g. ['Mod+Shift+Z', 'Mod+Y']. Tokens: Mod, Shift, Alt, then one key. */
	keys: string[];
	label: string;
	group: ShortcutGroup;
	run(ctx: BoardContext): void;
	/** Only active when this returns true. */
	when?(ctx: BoardContext): boolean;
}

export function isMacPlatform(): boolean {
	if (typeof navigator === 'undefined') return false;
	const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
	const platform = nav.userAgentData?.platform ?? navigator.platform ?? '';
	return /mac|iphone|ipad/i.test(platform);
}

/**
 * Whether a keyboard event matches a combo like 'Mod+Shift+Z', 'Shift+1', ']', '?', 'Delete'.
 * Letters match case-insensitively (Caps Lock, Alt-modified keys via `code`); Shift+digit matches
 * by `code` (layout-independent); single punctuation keys ignore Shift (e.g. '?' needs Shift).
 */
export function matchesKeys(e: KeyboardEvent, combo: string, mac = isMacPlatform()): boolean {
	const tokens = combo.split('+');
	// Allow a literal '+' key: 'Mod++' splits into ['Mod', '', ''].
	const key = combo.endsWith('++') ? '+' : (tokens.pop() ?? '');
	const mods = new Set(tokens.filter(Boolean).map((t) => t.toLowerCase()));

	const wantMod = mods.has('mod');
	const hasMod = mac ? e.metaKey : e.ctrlKey;
	const otherMod = mac ? e.ctrlKey : e.metaKey;
	if (wantMod !== hasMod || otherMod) return false;
	if (mods.has('alt') !== e.altKey) return false;

	const isLetter = /^[a-z]$/i.test(key);
	const isDigit = /^[0-9]$/.test(key);
	const isPunct = key.length === 1 && !isLetter && !isDigit;
	if (!isPunct && mods.has('shift') !== e.shiftKey) return false;

	if (isLetter)
		return e.key.toLowerCase() === key.toLowerCase() || e.code === `Key${key.toUpperCase()}`;
	if (isDigit) return e.code === `Digit${key}` || (!e.shiftKey && e.key === key);
	if (key === 'Space') return e.code === 'Space';
	return e.key === key;
}

export function isTypingTarget(t: EventTarget | null): boolean {
	if (!(t instanceof HTMLElement)) return false;
	if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable) return true;
	// Also covers nodes inside rich-text editors (and environments without isContentEditable).
	return !!t.closest('[contenteditable]:not([contenteditable="false"])');
}

/** Registered board shortcuts (commands from later steps add theirs). */
export class ShortcutRegistry {
	readonly all: Shortcut[] = [];

	register(list: Shortcut[]): void {
		for (const s of list) {
			const i = this.all.findIndex((x) => x.id === s.id);
			if (i >= 0) this.all.splice(i, 1, s);
			else this.all.push(s);
		}
	}

	find(e: KeyboardEvent, ctx: BoardContext): Shortcut | undefined {
		return this.all.find((s) => s.keys.some((k) => matchesKeys(e, k)) && (s.when?.(ctx) ?? true));
	}
}
