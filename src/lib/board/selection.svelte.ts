import { SvelteSet } from 'svelte/reactivity';
import type { Point, Rect } from '$lib/model/types';

/** Local (per-tab) selection, text-editing and hover state. Never stored in the document. */
export class SelectionState {
	readonly ids = new SvelteSet<string>();
	editingId = $state<string | null>(null);
	/** Where editing was entered (client coordinates of the double-click), if by pointer. */
	editingAt = $state<Point | null>(null);
	hoverId = $state<string | null>(null);
	/** Marquee rectangle (world) while dragging one. */
	marquee = $state<Rect | null>(null);
	/** True while elements are being moved/resized/rotated (hides hover feedback). */
	transforming = $state(false);
	/** A group the user double-clicked into: clicks then select single members. */
	enteredGroup = $state<string | null>(null);

	get size(): number {
		return this.ids.size;
	}

	/** The selected id when exactly one element is selected. */
	get single(): string | null {
		if (this.ids.size !== 1) return null;
		return this.ids.values().next().value ?? null;
	}

	has(id: string): boolean {
		return this.ids.has(id);
	}

	set(ids: Iterable<string>): void {
		// Temporary lookup set; the reactive state is `this.ids`.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const next = new Set(ids);
		for (const id of this.ids) if (!next.has(id)) this.ids.delete(id);
		for (const id of next) this.ids.add(id);
	}

	add(id: string): void {
		this.ids.add(id);
	}

	toggle(id: string): void {
		if (this.ids.has(id)) this.ids.delete(id);
		else this.ids.add(id);
	}

	clear(): void {
		this.ids.clear();
		this.editingId = null;
		this.enteredGroup = null;
	}

	/** Drops ids that no longer exist (e.g. deleted in another tab or by undo). */
	prune(exists: (id: string) => boolean): void {
		for (const id of this.ids) if (!exists(id)) this.ids.delete(id);
		if (this.editingId && !exists(this.editingId)) this.editingId = null;
		if (this.hoverId && !exists(this.hoverId)) this.hoverId = null;
	}
}
