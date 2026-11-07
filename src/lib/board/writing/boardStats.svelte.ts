import type * as Y from 'yjs';
import { getDocsMap } from '$lib/model/doc';
import type { Element } from '$lib/model/types';
import { fragmentToJSON } from '../doccards/fragmentJson';
import type { BoardStore } from '../boardStore.svelte';
import { countWords, docStats, docText } from './wordCount';

// After a pause in typing: a whole card is recounted from its stored text (can take ~100 ms).
const RECOUNT_MS = 800;

/**
 * Word counts of a board's text (shapes, stickies, text, doc cards). Doc card counts are cached
 * per card and recounted only after their text changed, once typing pauses.
 */
export class BoardWordStats {
	/** Bumps when counts may have changed. */
	version = $state(0);
	// A cache, not reactive state: `version` is the signal.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	readonly #cards = new Map<string, { words: number; lines: string[] }>();
	readonly #doc: Y.Doc;
	readonly #store: BoardStore;
	#timer: ReturnType<typeof setTimeout> | null = null;
	readonly #onDocs = (events: Y.YEvent<Y.AbstractType<unknown>>[]) => {
		for (const e of events) {
			const id = e.target === getDocsMap(this.#doc) ? null : e.path[0];
			if (typeof id === 'string') this.#cards.delete(id);
			else for (const key of (e as Y.YMapEvent<unknown>).keysChanged ?? []) this.#cards.delete(key);
		}
		if (this.#timer) clearTimeout(this.#timer);
		this.#timer = setTimeout(() => {
			this.#timer = null;
			this.version++;
		}, RECOUNT_MS);
	};

	constructor(doc: Y.Doc, store: BoardStore) {
		this.#doc = doc;
		this.#store = store;
		getDocsMap(doc).observeDeep(this.#onDocs);
	}

	#card(id: string): { words: number; lines: string[] } {
		let c = this.#cards.get(id);
		if (!c) {
			const frag = getDocsMap(this.#doc).get(id);
			const json = frag ? fragmentToJSON(frag) : null;
			c = json
				? { words: docStats(json).words, lines: docText(json).text.split('\n', 3) }
				: { words: 0, lines: [] };
			this.#cards.set(id, c);
		}
		return c;
	}

	cardWords(id: string): number {
		return this.#card(id).words;
	}

	/** The card's first line of text that isn't just its title (outline previews). */
	cardFirstLine(id: string, title = ''): string {
		void this.version;
		const t = title.trim().toLowerCase();
		return this.#card(id).lines.find((l) => l.trim().toLowerCase() !== t) ?? '';
	}

	elementWords(el: Element): number {
		switch (el.type) {
			case 'shape':
			case 'sticky':
			case 'text':
				return countWords(el.text);
			case 'doccard':
			case 'table':
				return this.cardWords(el.id);
			default:
				return 0;
		}
	}

	/** Words in these elements (all of the page's when omitted). */
	words(ids?: Iterable<string>): number {
		void this.version;
		void this.#store.version;
		let total = 0;
		if (ids) {
			for (const id of ids) {
				const el = this.#store.get(id);
				if (el) total += this.elementWords(el);
			}
		} else for (const el of this.#store.elements.values()) total += this.elementWords(el);
		return total;
	}

	destroy(): void {
		getDocsMap(this.#doc).unobserveDeep(this.#onDocs);
		if (this.#timer) clearTimeout(this.#timer);
	}
}
