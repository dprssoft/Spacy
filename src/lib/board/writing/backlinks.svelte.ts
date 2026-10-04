import type * as Y from 'yjs';
import { getDocsMap } from '$lib/model/doc';
import { listAllElements } from '$lib/model/pages';
import type { DocNode } from '../doccards/markdown';
import { fragmentToJSON } from '../doccards/fragmentJson';

export interface Backlink {
	cardId: string;
	cardTitle: string;
	/** ~80 characters around the mention, the mention itself as `@label`. */
	snippet: string;
}

const AROUND = 40;
const REFRESH_MS = 300;

/** Mentions in one card: target id → snippets (pure; exported for tests). */
export function mentionsIn(doc: DocNode): { target: string; snippet: string }[] {
	const out: { target: string; snippet: string }[] = [];
	const visit = (n: DocNode) => {
		const kids = n.content ?? [];
		if (!kids.some((k) => k.type === 'mention')) {
			kids.forEach(visit);
			return;
		}
		// A text block with mentions: its text, and where each mention sits in it.
		let text = '';
		const marks: { target: string; at: number; len: number }[] = [];
		for (const k of kids) {
			if (k.type === 'mention') {
				const label = `@${String(k.attrs?.label ?? '')}`;
				marks.push({ target: String(k.attrs?.id ?? ''), at: text.length, len: label.length });
				text += label;
			} else if (k.type === 'text') text += k.text ?? '';
			else if (k.type === 'hardBreak') text += ' ';
		}
		for (const m of marks) {
			if (!m.target) continue;
			const from = Math.max(0, m.at - AROUND);
			const to = Math.min(text.length, m.at + m.len + AROUND);
			const snippet = `${from > 0 ? '…' : ''}${text.slice(from, to).trim()}${to < text.length ? '…' : ''}`;
			out.push({ target: m.target, snippet });
		}
	};
	visit(doc);
	return out;
}

/**
 * Where each object is mentioned, across all doc cards of the board (all pages). Kept up to date
 * by observing doc card text; per-card results are cached.
 */
export class BacklinkIndex {
	version = $state(0);
	readonly #doc: Y.Doc;
	// Caches, not reactive state: `version` is the signal.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	readonly #cards = new Map<string, { target: string; snippet: string }[]>();
	#reverse: Map<string, Backlink[]> | null = null;
	#timer: ReturnType<typeof setTimeout> | null = null;
	readonly #onDocs = (events: Y.YEvent<Y.AbstractType<unknown>>[]) => {
		for (const e of events) {
			const id = e.target === getDocsMap(this.#doc) ? null : e.path[0];
			if (typeof id === 'string') this.#cards.delete(id);
			else for (const key of (e as Y.YMapEvent<unknown>).keysChanged ?? []) this.#cards.delete(key);
		}
		this.#reverse = null;
		if (this.#timer) clearTimeout(this.#timer);
		this.#timer = setTimeout(() => {
			this.#timer = null;
			this.version++;
		}, REFRESH_MS);
	};

	constructor(doc: Y.Doc) {
		this.#doc = doc;
		getDocsMap(doc).observeDeep(this.#onDocs);
	}

	#build(): Map<string, Backlink[]> {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const titles = new Map<string, string>();
		for (const el of listAllElements(this.#doc))
			if (el.type === 'doccard') titles.set(el.id, el.title);
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const reverse = new Map<string, Backlink[]>();
		for (const [cardId, frag] of getDocsMap(this.#doc)) {
			const title = titles.get(cardId);
			if (title === undefined) continue; // a leftover fragment without its card
			let mentions = this.#cards.get(cardId);
			if (!mentions) this.#cards.set(cardId, (mentions = mentionsIn(fragmentToJSON(frag))));
			for (const m of mentions) {
				if (m.target === cardId) continue;
				const list = reverse.get(m.target) ?? [];
				list.push({ cardId, cardTitle: title || 'Untitled', snippet: m.snippet });
				reverse.set(m.target, list);
			}
		}
		return reverse;
	}

	/** Where `targetId` is mentioned. */
	of(targetId: string): Backlink[] {
		void this.version;
		this.#reverse ??= this.#build();
		return this.#reverse.get(targetId) ?? [];
	}

	destroy(): void {
		getDocsMap(this.#doc).unobserveDeep(this.#onDocs);
		if (this.#timer) clearTimeout(this.#timer);
	}
}
