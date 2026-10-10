// Presence on a shared board (step 53): what each person publishes through Yjs awareness.
import type { Awareness } from 'y-protocols/awareness';

export interface Cursor {
	x: number;
	y: number;
	page: string;
}

export interface Peer {
	clientId: number;
	name: string;
	color: string;
	cursor: Cursor | null;
}

// Strong colors from the palette (§12): readable as a pointer and behind white label text.
const COLORS = ['#e03131', '#f76707', '#2f9e44', '#0c8599', '#1971c2', '#6741d9', '#c2255c'];

export const colorFor = (clientId: number): string => COLORS[clientId % COLORS.length]!;

export const guestName = (clientId: number): string => `Guest ${clientId % 1000}`;

function readCursor(v: unknown): Cursor | null {
	if (!v || typeof v !== 'object') return null;
	const { x, y, page } = v as Record<string, unknown>;
	return typeof x === 'number' && typeof y === 'number' && typeof page === 'string'
		? { x, y, page }
		: null;
}

/** Everyone else on the board, by client id. Entries without a user (no presence yet) are skipped. */
export function readPeers(awareness: Awareness): Peer[] {
	const peers: Peer[] = [];
	for (const [clientId, state] of awareness.getStates()) {
		if (clientId === awareness.clientID) continue;
		const user = (state as Record<string, unknown>).user as Record<string, unknown> | undefined;
		if (!user || typeof user.name !== 'string') continue;
		peers.push({
			clientId,
			name: user.name.slice(0, 40) || guestName(clientId),
			color:
				typeof user.color === 'string' && /^#[0-9a-f]{6}$/i.test(user.color)
					? user.color
					: colorFor(clientId),
			cursor: readCursor((state as Record<string, unknown>).cursor)
		});
	}
	return peers.sort((a, b) => a.clientId - b.clientId);
}

/** Calls `fn` at most once per `ms`, always with the latest value (trailing call included). */
export function throttle<T>(fn: (v: T) => void, ms: number): ((v: T) => void) & { cancel(): void } {
	let last = 0;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let pending: { v: T } | null = null;
	const run = () => {
		timer = null;
		last = Date.now();
		if (pending) fn(pending.v);
		pending = null;
	};
	const call = (v: T) => {
		pending = { v };
		if (timer) return;
		const wait = Math.max(0, last + ms - Date.now());
		if (wait === 0) run();
		else timer = setTimeout(run, wait);
	};
	return Object.assign(call, {
		cancel() {
			if (timer) clearTimeout(timer);
			timer = null;
			pending = null;
		}
	});
}
