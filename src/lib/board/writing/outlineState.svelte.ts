import { ensureOutlineMap, getOutline, setOutline } from '$lib/model/outline';
import { getActivePageId } from '$lib/model/doc';
import { updateElements } from '$lib/model/ops';
import { LOCAL } from '$lib/model/origins';
import type { DocCardElement, ElementPatch, FrameElement } from '$lib/model/types';
import { getPref, setPref } from '$lib/shared/localPrefs';
import type { BoardContext } from '../context';
import { syncFrameMembership } from '../frameMembership';
import { moveInOutline, outlineChapters, type Chapter } from './outline';

const PAD = 24;

/** The outline panel's data and open state (one board at a time). */
export class OutlineState {
	open = $state(false);
	/** Bumps when the stored order changes (here, in another tab, or by undo). */
	#version = $state(0);
	readonly #ctx: BoardContext;
	readonly #stop: () => void;

	constructor(ctx: BoardContext) {
		this.#ctx = ctx;
		this.open = getPref<boolean>(`outline:${ctx.id}`, false) === true;
		const map = ensureOutlineMap(ctx.doc);
		const bump = () => this.#version++;
		map.observe(bump);
		this.#stop = () => map.unobserve(bump);
	}

	toggle(): void {
		this.open = !this.open;
		setPref(`outline:${this.#ctx.id}`, this.open);
	}

	get chapters(): Chapter[] {
		void this.#version;
		const { store, doc } = this.#ctx;
		void store.version;
		const cards: DocCardElement[] = [];
		const frames: FrameElement[] = [];
		for (const el of store.elements.values()) {
			if (el.type === 'doccard') cards.push(el);
			else if (el.type === 'frame') frames.push(el);
		}
		return outlineChapters(cards, frames, getOutline(doc, getActivePageId(doc)));
	}

	/**
	 * Moves a card in the manuscript. Into another chapter it also moves into that frame on the
	 * board (below its contents; the frame grows if needed). One undo step.
	 */
	move(id: string, toFrame: string | null, index: number): void {
		const { doc, store, undo } = this.#ctx;
		const chapters = this.chapters;
		const card = store.get(id);
		if (card?.type !== 'doccard') return;
		const order = moveInOutline(chapters, id, toFrame, index);
		const patches: { id: string; patch: ElementPatch }[] = [];
		const target = toFrame ? store.get(toFrame) : null;
		if (target?.type === 'frame' && card.parentId !== target.id) {
			const inside = chapters.find((c) => c.frame?.id === target.id)?.cards ?? [];
			const y = inside.length ? Math.max(...inside.map((c) => c.y + c.h)) + PAD : target.y + PAD;
			patches.push({ id, patch: { x: target.x + PAD, y } });
			const needH = y + card.h + PAD - target.y;
			const needW = card.w + PAD * 2;
			if (needH > target.h || needW > target.w)
				patches.push({
					id: target.id,
					patch: { h: Math.max(target.h, needH), w: Math.max(target.w, needW) }
				});
		} else if (toFrame === null && card.parentId) {
			// Out of its chapter: next to everything else on the page.
			const b = store.contentBounds();
			if (b) patches.push({ id, patch: { x: b.x + b.w + 80, y: b.y } });
		}
		undo.stopCapturing();
		doc.transact(() => {
			if (patches.length) updateElements(doc, patches);
			setOutline(doc, getActivePageId(doc), order);
		}, LOCAL);
		if (patches.length)
			syncFrameMembership(
				this.#ctx,
				patches.map((p) => p.id)
			);
		undo.stopCapturing();
	}

	destroy(): void {
		this.#stop();
	}
}
