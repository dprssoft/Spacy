import { SvelteMap } from 'svelte/reactivity';
import type * as Y from 'yjs';
import { getElementsMap, readElement, type ElementYMap } from '$lib/model/doc';
import type { Element, Rect } from '$lib/model/types';
import { compareZ } from '$lib/model/zorder';
import type { DiagramWorld } from './diagram/endpoints';
import { ConnectorIndex } from './diagram/connectorIndex';
import { boardWorld } from './diagram/world';
import { definitionOf } from './elements';
import { SpatialIndex } from './engine/spatialIndex';
import { readStrokes } from './sketch/data';

/**
 * Reactive, read-only view of a board's elements (00-architecture.md §7).
 * Components get immutable snapshots; writes go through model/ops.
 */
export class BoardStore {
	readonly elements = new SvelteMap<string, Element>();
	/** Non-frame ids sorted by z. Recomputed only on add/remove/z change. */
	order = $state<string[]>([]);
	/** Frame ids sorted by z (frames render beneath everything else). */
	frameOrder = $state<string[]>([]);
	/** Increments once per handled change — a cheap "something changed" signal. */
	version = $state(0);
	readonly index = new SpatialIndex();
	readonly connectors = new ConnectorIndex();
	readonly world: DiagramWorld = boardWorld(
		(id) => this.elements.get(id),
		(id) => readStrokes(this.#doc, id)
	);

	readonly #doc: Y.Doc;
	#map: Y.Map<ElementYMap>;
	readonly #observer = (events: Y.YEvent<Y.AbstractType<unknown>>[]) => {
		// A throwaway per-transaction set, not reactive state.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const changed = new Set<string>();
		for (const e of events) {
			if (e.target === this.#map) {
				for (const key of e.changes.keys.keys()) changed.add(key);
			} else {
				const id = e.path[0];
				if (typeof id === 'string') changed.add(id);
			}
		}
		this.#apply(changed);
	};

	constructor(doc: Y.Doc) {
		this.#doc = doc;
		this.#map = getElementsMap(doc);
		this.#load();
		this.#map.observeDeep(this.#observer);
	}

	/** Switches to the document's active page: everything is reloaded from that page's elements. */
	rebind(): void {
		this.#map.unobserveDeep(this.#observer);
		this.#map = getElementsMap(this.#doc);
		this.elements.clear();
		this.index.clear();
		this.connectors.clear();
		this.#load();
		this.#map.observeDeep(this.#observer);
		this.version++;
	}

	#load(): void {
		for (const [id, ymap] of this.#map) {
			const el = readElement(ymap);
			if (el) this.elements.set(id, el);
		}
		// Second pass: connector bounds need the elements they attach to.
		const entries: [string, Rect][] = [];
		for (const el of this.elements.values()) {
			if (el.type === 'connector') this.connectors.add(el);
			entries.push([el.id, this.#aabb(el)]);
		}
		this.index.load(entries);
		this.#recomputeOrder();
	}

	get(id: string): Element | undefined {
		return this.elements.get(id);
	}

	/** Connectors attached to an element. */
	connectorsOf(id: string): string[] {
		return this.connectors.of(id);
	}

	/** Union of all element AABBs, or null for an empty board. */
	contentBounds(): Rect | null {
		return this.index.bounds();
	}

	destroy(): void {
		this.#map.unobserveDeep(this.#observer);
	}

	#aabb(el: Element): Rect {
		return definitionOf(el).aabb(el, this.world);
	}

	#apply(ids: Set<string>): void {
		let orderDirty = false;
		// Changed elements plus connectors attached to them (their bounds follow the elements).
		const touched: string[] = [];
		for (const id of ids) {
			const ymap = this.#map.get(id);
			const next = ymap ? readElement(ymap) : null;
			const prev = this.elements.get(id);
			this.connectors.remove(prev);
			if (next) {
				this.elements.set(id, next);
				this.connectors.add(next);
				touched.push(id);
				if (!prev || prev.z !== next.z) orderDirty = true;
			} else if (prev) {
				this.elements.delete(id);
				this.index.remove(id);
				orderDirty = true;
			}
			touched.push(...this.connectors.of(id));
		}
		for (const id of touched) {
			const el = this.elements.get(id);
			if (el) this.index.upsert(id, this.#aabb(el));
		}
		if (orderDirty) this.#recomputeOrder();
		this.version++;
	}

	#recomputeOrder(): void {
		const frames: Element[] = [];
		const rest: Element[] = [];
		for (const el of this.elements.values()) (el.type === 'frame' ? frames : rest).push(el);
		const byZ = (a: Element, b: Element) => compareZ(a.z, b.z);
		this.frameOrder = frames.sort(byZ).map((e) => e.id);
		this.order = rest.sort(byZ).map((e) => e.id);
	}
}
