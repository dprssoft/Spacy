import type { Awareness } from 'y-protocols/awareness';
import type { LiveSession } from '$lib/storage/live/session';
import { colorFor, guestName, readPeers, throttle, type Cursor, type Peer } from './presenceData';

const CURSOR_MS = 50;

/** Who else is on the shared board, and this person's own name and pointer, via awareness. */
export class Presence {
	peers = $state<Peer[]>([]);
	#awareness: Awareness | null = null;
	readonly #offSession: () => void;
	readonly #sendCursor = throttle((c: Cursor | null) => {
		this.#awareness?.setLocalStateField('cursor', c);
	}, CURSOR_MS);

	constructor(
		private readonly session: LiveSession,
		private readonly name: () => string
	) {
		this.#offSession = session.subscribe(() => this.#bind(session.awareness));
		this.#bind(session.awareness);
	}

	setCursor(cursor: Cursor | null): void {
		if (cursor) this.#sendCursor(cursor);
		else {
			this.#sendCursor.cancel();
			this.#awareness?.setLocalStateField('cursor', null);
		}
	}

	/** Call when the person's name changes. */
	refreshUser(): void {
		const a = this.#awareness;
		if (!a) return;
		const name = this.name().trim() || guestName(a.clientID);
		a.setLocalStateField('user', { name, color: colorFor(a.clientID) });
	}

	destroy(): void {
		this.#offSession();
		this.#sendCursor.cancel();
		this.#bind(null);
	}

	readonly #onChange = () => {
		if (this.#awareness) this.peers = readPeers(this.#awareness);
	};

	#bind(awareness: Awareness | null): void {
		if (awareness === this.#awareness) return;
		this.#awareness?.off('change', this.#onChange);
		this.#awareness = awareness;
		this.peers = [];
		if (!awareness) return;
		awareness.on('change', this.#onChange);
		this.refreshUser();
		this.#onChange();
	}
}
