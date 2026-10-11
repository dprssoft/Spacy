import type * as Y from 'yjs';
import { resolve } from '$app/paths';
import { getMeta } from '$lib/model/doc';
import { getShare, newShare, setShare, shareHash, type ShareInfo } from '$lib/model/share';
import type { LiveSession, LiveState } from '$lib/storage/live/session';
import { clockSkewMs, describeSkew, MAX_SKEW_MS } from '$lib/storage/live/clock';
import { setClockSkew } from '../widgets/clock';
import { commentAuthor } from '../comments/author.svelte';
import { Presence } from './presence.svelte';

/** Live sharing for the board UI: whether it's shared, the link, and who's connected. */
export class LiveShare {
	share = $state<ShareInfo | null>(null);
	state = $state<LiveState>({ kind: 'off' });
	/** Someone couldn't be reached (a network that blocks direct connections). */
	problem = $state<string | null>(null);
	/** Set when this computer's clock is too far off for live sharing ("about 3 hours ahead"). */
	clockOff = $state<string | null>(null);
	#clockChecked = false;
	/** Names and pointers of the others (step 53). */
	readonly presence: Presence;
	readonly #off: () => void;

	constructor(
		private readonly id: string,
		private readonly doc: Y.Doc,
		readonly session: LiveSession
	) {
		const meta = getMeta(doc);
		const read = () => {
			this.share = getShare(doc);
			// Shared widget timers need this clock corrected (once, when the board is shared).
			if (this.share) void this.checkClock();
		};
		meta.observe(read);
		read();
		const offState = session.subscribe(() => {
			this.state = session.state;
			this.problem = session.problem;
		});
		this.state = session.state;
		this.presence = new Presence(session, () => commentAuthor.name);
		this.#off = () => {
			this.presence.destroy();
			meta.unobserve(read);
			offState();
		};
	}

	get link(): string | null {
		if (!this.share) return null;
		return `${location.origin}${resolve('/board/[id]', { id: this.id })}#${shareHash(this.share)}`;
	}

	start(): void {
		if (!this.share) setShare(this.doc, newShare());
	}

	/** Checks the clock once (when the popover opens or a board is shared). */
	async checkClock(): Promise<void> {
		if (this.#clockChecked) return;
		this.#clockChecked = true;
		const skew = await clockSkewMs();
		// Shared widget timers count from absolute times: correct this clock for them.
		setClockSkew(skew);
		this.clockOff = skew !== null && Math.abs(skew) > MAX_SKEW_MS ? describeSkew(skew) : null;
	}

	/** Everyone disconnects; sharing again makes a new link. */
	stop(): void {
		setShare(this.doc, null);
	}

	destroy(): void {
		this.#off();
	}
}
