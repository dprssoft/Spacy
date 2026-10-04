import {
	commentQuotes,
	createThread,
	getCommentsMap,
	listThreads,
	type CommentThread
} from '$lib/model/comments';
import { getDocsMap } from '$lib/model/doc';
import { newId } from '$lib/model/ids';
import { LOCAL } from '$lib/model/origins';
import { getPref, setPref } from '$lib/shared/localPrefs';
import type { BoardContext } from '../context';
import type { Editor } from '../doccards/editorFactory';

/** A text range waiting for its first comment (the mark is applied when it's posted). */
export interface TextDraft {
	cardId: string;
	threadId: string;
	editor: Editor;
	from: number;
	to: number;
	quote: string;
}

/** What the thread popover shows. */
export type CommentPopover =
	/** An object's open threads plus a box for a new comment. */
	| { kind: 'element'; elementId: string }
	| { kind: 'thread'; threadId: string }
	| { kind: 'draft'; draft: TextDraft };

export type CommentFilter = 'open' | 'resolved';

export const targetOf = (t: CommentThread): string =>
	t.anchor.kind === 'element' ? t.anchor.elementId : t.anchor.cardId;

/** Comment threads of a board for the UI: badges, the popover and the panel. */
export class CommentsState {
	threads = $state.raw<CommentThread[]>([]);
	popover = $state.raw<CommentPopover | null>(null);
	panelOpen = $state(false);
	filter = $state<CommentFilter>('open');
	/** Bumps when doc card text changes (quotes of text threads). */
	#textVersion = $state(0);
	readonly #ctx: BoardContext;
	readonly #stop: () => void;

	constructor(ctx: BoardContext) {
		this.#ctx = ctx;
		this.panelOpen = getPref<boolean>(`comments:${ctx.id}`, false) === true;
		const map = getCommentsMap(ctx.doc);
		const docs = getDocsMap(ctx.doc);
		const refresh = () => (this.threads = listThreads(ctx.doc));
		const bumpText = () => this.#textVersion++;
		refresh();
		map.observeDeep(refresh);
		docs.observeDeep(bumpText);
		this.#stop = () => {
			map.unobserveDeep(refresh);
			docs.unobserveDeep(bumpText);
		};
	}

	destroy(): void {
		this.#stop();
	}

	togglePanel(): void {
		this.panelOpen = !this.panelOpen;
		setPref(`comments:${this.#ctx.id}`, this.panelOpen);
	}

	/** Unresolved threads per element (text threads count on their doc card). */
	readonly openByElement = $derived.by(() => {
		// Rebuilt whole from `threads`; never mutated.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const counts = new Map<string, number>();
		for (const t of this.threads)
			if (!t.resolved) counts.set(targetOf(t), (counts.get(targetOf(t)) ?? 0) + 1);
		return counts;
	});

	/** Threads whose object is on the shown page, in reading order of their objects. */
	get onPage(): CommentThread[] {
		const { store } = this.#ctx;
		void store.version;
		const at = (t: CommentThread) => store.get(targetOf(t));
		return this.threads
			.filter((t) => at(t))
			.sort((a, b) => {
				const ea = at(a)!;
				const eb = at(b)!;
				return ea.y - eb.y || ea.x - eb.x || a.createdAt - b.createdAt;
			});
	}

	/** The commented text of a text thread; '' when its text was deleted (orphaned). */
	quote(t: CommentThread): string {
		if (t.anchor.kind !== 'text') return '';
		void this.#textVersion;
		const frag = getDocsMap(this.#ctx.doc).get(t.anchor.cardId);
		return frag ? (commentQuotes(frag).get(t.id) ?? '') : '';
	}

	thread(id: string): CommentThread | undefined {
		return this.threads.find((t) => t.id === id);
	}

	openElement(elementId: string): void {
		this.popover = { kind: 'element', elementId };
	}

	openThread(threadId: string): void {
		if (this.thread(threadId)) this.popover = { kind: 'thread', threadId };
	}

	/** Starts a comment on the editor's selected text. */
	startText(cardId: string, editor: Editor): void {
		const { from, to, empty } = editor.state.selection;
		if (empty) return;
		const quote = editor.state.doc.textBetween(from, to, ' ');
		this.popover = { kind: 'draft', draft: { cardId, threadId: newId(), editor, from, to, quote } };
	}

	/** Posts the first comment of a draft: marks the text, then creates the thread. */
	postDraft(draft: TextDraft, author: string, text: string): void {
		const { editor, from, to, threadId } = draft;
		if (!editor.isDestroyed)
			editor
				.chain()
				.setTextSelection({ from, to })
				.setMark('comment', { threadId })
				.setTextSelection(to)
				.run();
		this.#ctx.undo.stopCapturing();
		createThread(
			this.#ctx.doc,
			{
				anchor: { kind: 'text', cardId: draft.cardId },
				page: this.#ctx.pages.current,
				author,
				text,
				id: threadId
			},
			LOCAL
		);
		this.popover = { kind: 'thread', threadId };
	}

	close(): void {
		this.popover = null;
	}
}
