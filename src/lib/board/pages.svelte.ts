import { getMeta, pageElementsMap } from '$lib/model/doc';
import {
	activePage,
	addPage,
	deletePages,
	duplicatePage,
	getPages,
	movePage,
	movePageTo,
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
	/** Tabs picked with Ctrl/Cmd- or Shift-click, besides the current one (empty: just it). */
	picked = $state<string[]>([]);
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
		this.picked = this.picked.filter((id) => next.some((p) => p.id === id));
		for (const p of next) undo.addToScope(pageElementsMap(doc, p.id));
		if (!next.some((p) => p.id === this.current)) this.#show(next[0]!.id);
	}

	/**
	 * The pages a tab menu acts on: all picked pages (in page order) when `pageId` is one of them,
	 * otherwise just `pageId`.
	 */
	targets(pageId: string): string[] {
		const ids = this.selectedIds;
		return ids.includes(pageId) ? ids : [pageId];
	}

	/** The current page plus the picked ones, in page order. */
	get selectedIds(): string[] {
		return this.list
			.filter((p) => p.id === this.current || this.picked.includes(p.id))
			.map((p) => p.id);
	}

	/** Ctrl/Cmd-click: adds a tab to the picked pages or takes it out (without switching pages). */
	togglePick(pageId: string): void {
		if (pageId === this.current) return;
		this.picked = this.picked.includes(pageId)
			? this.picked.filter((id) => id !== pageId)
			: [...this.picked, pageId];
	}

	/** Shift-click: picks every page between the current one and this one. */
	pickRange(pageId: string): void {
		const ids = this.list.map((p) => p.id);
		const from = ids.indexOf(this.current);
		const to = ids.indexOf(pageId);
		if (from < 0 || to < 0) return;
		const [a, b] = from < to ? [from, to] : [to, from];
		this.picked = ids.slice(a, b + 1).filter((id) => id !== this.current);
	}

	/** Shows a page: ends editing, clears the selection and restores that page's view. */
	select(pageId: string): void {
		this.picked = [];
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

	moveTo(pageId: string, index: number): void {
		movePageTo(this.#ctx.doc, pageId, index);
		this.#sync();
	}

	/** Adds a copy of a page after it and shows it, at the same view. */
	duplicate(pageId: string): Page | null {
		const page = duplicatePage(this.#ctx.doc, pageId);
		if (!page) return null;
		const view = pageId === this.current ? this.#ctx.viewport.vp : this.#views.get(pageId);
		if (view) this.#views.set(page.id, view);
		this.#sync();
		this.select(page.id);
		return page;
	}

	/** Deletes pages and their content for good (the undo history is cleared). */
	remove(pageIds: string | readonly string[]): void {
		const { doc, undo } = this.#ctx;
		const ids = typeof pageIds === 'string' ? [pageIds] : pageIds;
		const wasCurrent = ids.includes(this.current);
		// After deleting the current page, show the nearest page before it that's left.
		const index = this.list.findIndex((p) => p.id === this.current);
		const before = this.list.slice(0, index).filter((p) => !ids.includes(p.id));
		if (!deletePages(doc, ids)) return;
		// Steps that touched the deleted pages can't be replayed.
		undo.clear();
		for (const id of ids) this.#views.delete(id);
		this.list = getPages(doc);
		this.picked = [];
		if (wasCurrent) this.#show((before.at(-1) ?? this.list[0]!).id);
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
