import RBush from 'rbush';
import type { Point, Rect } from '$lib/model/types';

interface Item {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
	id: string;
}

const toItem = (id: string, r: Rect): Item => ({
	id,
	minX: r.x,
	minY: r.y,
	maxX: r.x + r.w,
	maxY: r.y + r.h
});

/** World-space AABB index of element ids (non-reactive). */
export class SpatialIndex {
	#tree = new RBush<Item>();
	#items = new Map<string, Item>();

	get size(): number {
		return this.#items.size;
	}

	upsert(id: string, aabb: Rect): void {
		const prev = this.#items.get(id);
		if (prev) this.#tree.remove(prev);
		const item = toItem(id, aabb);
		this.#items.set(id, item);
		this.#tree.insert(item);
	}

	/** Bulk load (much faster than repeated inserts). Replaces the whole index. */
	load(entries: Iterable<[string, Rect]>): void {
		this.clear();
		const items = [...entries].map(([id, r]) => toItem(id, r));
		for (const it of items) this.#items.set(it.id, it);
		this.#tree.load(items);
	}

	remove(id: string): void {
		const prev = this.#items.get(id);
		if (!prev) return;
		this.#tree.remove(prev);
		this.#items.delete(id);
	}

	get(id: string): Rect | undefined {
		const it = this.#items.get(id);
		return it && { x: it.minX, y: it.minY, w: it.maxX - it.minX, h: it.maxY - it.minY };
	}

	/** Ids whose AABB intersects `rect` (touching counts). */
	search(rect: Rect): string[] {
		return this.#tree
			.search({ minX: rect.x, minY: rect.y, maxX: rect.x + rect.w, maxY: rect.y + rect.h })
			.map((it) => it.id);
	}

	/** Ids whose AABB is within `tol` of `p`. */
	near(p: Point, tol: number): string[] {
		return this.search({ x: p.x - tol, y: p.y - tol, w: tol * 2, h: tol * 2 });
	}

	/** Union of all AABBs, or null when empty. */
	bounds(): Rect | null {
		if (this.#items.size === 0) return null;
		const { minX, minY, maxX, maxY } = this.#tree.toJSON() as Item;
		return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
	}

	clear(): void {
		this.#tree.clear();
		this.#items.clear();
	}
}
