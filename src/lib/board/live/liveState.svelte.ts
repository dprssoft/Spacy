import type * as Y from 'yjs';
import { resolve } from '$app/paths';
import { getMeta } from '$lib/model/doc';
import { getShare, newShare, setShare, shareHash, type ShareInfo } from '$lib/model/share';
import type { LiveSession, LiveState } from '$lib/storage/live/session';

/** Live sharing for the board UI: whether it's shared, the link, and who's connected. */
export class LiveShare {
	share = $state<ShareInfo | null>(null);
	state = $state<LiveState>({ kind: 'off' });
	readonly #off: () => void;

	constructor(
		private readonly id: string,
		private readonly doc: Y.Doc,
		readonly session: LiveSession
	) {
		const meta = getMeta(doc);
		const read = () => (this.share = getShare(doc));
		meta.observe(read);
		read();
		const offState = session.subscribe(() => (this.state = session.state));
		this.state = session.state;
		this.#off = () => {
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

	/** Everyone disconnects; sharing again makes a new link. */
	stop(): void {
		setShare(this.doc, null);
	}

	destroy(): void {
		this.#off();
	}
}
