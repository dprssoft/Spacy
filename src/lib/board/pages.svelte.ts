import { getMeta, pageElementsMap } from '$lib/model/doc';
import {
	activePage,
	addPage,
	deletePage,
	getPages,
	movePage,
	pageOfElement,
	renamePage,
	setActivePage,
	type Page
} from '$lib/model/pages';
import { getPref, setPref } from '$lib/shared/localPrefs';
import type { BoardContext } from './context';
import { centeredOrigin, fitRect, type Viewport } from './engine/viewport';

interface StackEvent {
	stackItem: { meta: Map<unknown, unknown> };
	changedParentTypes?: Map<unknown, unknown>;
}

const lastPageKey = (boardId: string) => `page:${boardId}`;

/**
 * The board's pages (sheet tabs) and which one this tab shows. Switching pages points the document
 * and the store at that page's elements; everything else (tools, selection, export…) then works
 * on it unchanged.
 */
export class PagesState {
	list = $state<Page[]>([]);
	current = $state('');
	readonly #ctx: BoardContext;
	/** Where the view was on each page, for this session. */
	// Plain bookkeeping, not rendered.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	readonly #views = new Map<string, Viewport>();
	readonly #onMeta = () => this.#sync();
	readonly #onAdded = (e: StackEvent) => {
		// Remember which page the step changed (not which page is showing: a redo entry is created
		// while the previous page is still on screen).
		const { doc } = this.#ctx;
		const touched = this.list.find((p) => e.changedParentTypes?.has(pageElementsMap(doc, p.id)));
		e.stackItem.meta.set('page', touched?.id ?? this.current);
	};
	readonly #onPopped = (e: StackEvent) => {
		// Undo and redo happen where the change was made, like in a spreadsheet.
		const page = e.stackItem.meta.get('page');
		if (typeof page === 'string' && page !== this.current) this.select(page);
	};

	constructor(ctx: BoardContext) {
		this.#ctx = ctx;
		const { doc, undo, id } = ctx;
		this.list = getPages(doc);
		// Reopen on the page that was last shown in this browser.
		const last = getPref<string>(lastPageKey(id), '');
		if (this.list.some((p) => p.id === last)) setActivePage(doc, last);
		this.current = activePage(doc).id;
		setActivePage(doc, this.current);
		for (const p of this.list) undo.addToScope(pageElementsMap(doc, p.id));
		getMeta(doc).observe(this.#onMeta);
		undo.on('stack-item-added', this.#onAdded);
		undo.on('stack-item-popped', this.#onPopped);
	}

	get page(): Page {
		return this.list.find((p) => p.id === this.current) ?? this.list[0]!;
	}

	/** Page list changed (here or in another tab): follow it, and leave a page that was deleted. */
	#sync(): void {
		const { doc, undo } = this.#ctx;
		const next = getPages(doc);
		const same =
			next.length === this.list.length &&
			next.every((p, i) => p.id === this.list[i]?.id && p.name === this.list[i]?.name);
		if (same) return;
		this.list = next;
		for (const p of next) undo.addToScope(pageElementsMap(doc, p.id));
		if (!next.some((p) => p.id === this.current)) this.#show(next[0]!.id);
	}

	/** Shows a page: ends editing, clears the selection and restores that page's view. */
	select(pageId: string): void {
		if (pageId === this.current || !this.list.some((p) => p.id === pageId)) return;
		this.#views.set(this.current, this.#ctx.viewport.vp);
		this.#show(pageId);
	}

	#show(pageId: string): void {
		const { doc, store, selection, tools, editing, viewport, preview, id } = this.#ctx;
		editing.end();
		this.#ctx.playback.stopAll();
		tools.tool.onCancel();
		selection.clear();
		selection.hoverId = null;
		preview.pulse = null;
		setActivePage(doc, pageId);
		this.current = pageId;
		store.rebind();
		setPref(lastPageKey(id), pageId);
		if (viewport.size.w === 0) return; // not laid out yet: the canvas places the first view
		const content = store.contentBounds();
		viewport.set(
			this.#views.get(pageId) ??
				(content ? fitRect(content, viewport.size, 64, 1) : centeredOrigin(viewport.size))
		);
	}

	add(): Page {
		const page = addPage(this.#ctx.doc, { afterId: this.current });
		this.#sync();
		this.select(page.id);
		return page;
	}

	rename(pageId: string, name: string): void {
		renamePage(this.#ctx.doc, pageId, name);
		this.#sync();
	}

	move(pageId: string, delta: -1 | 1): void {
		movePage(this.#ctx.doc, pageId, delta);
		this.#sync();
	}

	/** Deletes a page and its content for good (the undo history is cleared). */
	remove(pageId: string): void {
		const { doc, undo } = this.#ctx;
		const wasCurrent = pageId === this.current;
		const index = this.list.findIndex((p) => p.id === pageId);
		if (!deletePage(doc, pageId)) return;
		// Steps that touched the deleted page can't be replayed.
		undo.clear();
		this.#views.delete(pageId);
		this.list = getPages(doc);
		if (wasCurrent) this.#show((this.list[Math.max(0, index - 1)] ?? this.list[0]!).id);
	}

	/** Shows the page an element is on. Returns false if it isn't on any page. */
	reveal(elementId: string): boolean {
		const page = pageOfElement(this.#ctx.doc, elementId);
		if (!page) return false;
		this.select(page);
		return true;
	}

	destroy(): void {
		getMeta(this.#ctx.doc).unobserve(this.#onMeta);
		this.#ctx.undo.off('stack-item-added', this.#onAdded);
		this.#ctx.undo.off('stack-item-popped', this.#onPopped);
	}
}
