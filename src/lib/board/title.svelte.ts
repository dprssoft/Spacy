import type * as Y from 'yjs';
import { getMeta } from '$lib/model/doc';
import { setMeta } from '$lib/model/ops';
import { LOCAL } from '$lib/model/origins';
import * as boardsRepo from '$lib/storage/boardsRepo';

/**
 * The board title. `meta.title` in the Y.Doc is the source of truth on the board page; the board
 * list (boardsRepo) is kept in step, including for renames made in another tab.
 */
export class BoardTitle {
	value = $state('');
	readonly #id: string;
	readonly #meta: Y.Map<unknown>;
	readonly #observer: (e: Y.YMapEvent<unknown>, tr: Y.Transaction) => void;

	constructor(id: string, doc: Y.Doc) {
		this.#id = id;
		this.#meta = getMeta(doc);
		this.value = this.#read();
		this.#observer = (e, tr) => {
			if (!e.keysChanged.has('title')) return;
			this.value = this.#read();
			// Local renames already updated the list; mirror renames that arrived from elsewhere.
			if (tr.origin !== LOCAL && this.value) void boardsRepo.rename(this.#id, this.value);
		};
		this.#meta.observe(this.#observer);
	}

	#read(): string {
		const t = this.#meta.get('title');
		return typeof t === 'string' ? t : '';
	}

	rename(next: string): void {
		const t = next.trim();
		if (!t || t === this.value) return;
		setMeta(this.#meta.doc!, 'title', t, LOCAL);
		void boardsRepo.rename(this.#id, t);
	}

	destroy(): void {
		this.#meta.unobserve(this.#observer);
	}
}
