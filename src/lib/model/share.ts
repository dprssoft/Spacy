// Live sharing (step 52): a shared board carries its room and key in `meta.share`, so every
// device of every person who has it joins the same session. Not in undo scope.
import { nanoid } from 'nanoid';
import type * as Y from 'yjs';
import { getMeta } from './doc';
import { setMeta } from './ops';
import { LOCAL, type Origin } from './origins';

export interface ShareInfo {
	room: string;
	key: string;
}

const ROOM = /^[\w-]{16}$/;
const KEY = /^[\w-]{24}$/;

export function isShareInfo(v: unknown): v is ShareInfo {
	if (!v || typeof v !== 'object') return false;
	const { room, key } = v as Record<string, unknown>;
	return typeof room === 'string' && ROOM.test(room) && typeof key === 'string' && KEY.test(key);
}

export function getShare(doc: Y.Doc): ShareInfo | null {
	const v = getMeta(doc).get('share');
	return isShareInfo(v) ? { room: v.room, key: v.key } : null;
}

export function newShare(): ShareInfo {
	return { room: nanoid(16), key: nanoid(24) };
}

export function setShare(doc: Y.Doc, share: ShareInfo | null, origin: Origin = LOCAL): void {
	setMeta(doc, 'share', share, origin);
}

/** The part of a share link after `#`. */
export function shareHash(share: ShareInfo): string {
	return `live=${share.room}.${share.key}`;
}

/** Reads `#live=<room>.<key>`; anything else is null. */
export function parseShareHash(hash: string): ShareInfo | null {
	const m = /^#?live=([\w-]+)\.([\w-]+)$/.exec(hash);
	const share = m ? { room: m[1], key: m[2] } : null;
	return isShareInfo(share) ? share : null;
}
