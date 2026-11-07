import { newId } from '$lib/model/ids';
import { createElements, deleteElements, updateElement } from '$lib/model/ops';
import { baseStyleFor } from '$lib/model/defaults';
import type { Point, WaystoneElement } from '$lib/model/types';
import { fullscreen } from '$lib/shared/fullscreen.svelte';
import { getPref, setPref } from '$lib/shared/localPrefs';
import type { BoardContext } from '../context';
import { screenToWorld } from '../engine/viewport';
import {
	boxAt,
	clampWaystoneZoom,
	flyTarget,
	orderAfter,
	orderForMove,
	routeOf,
	stepIndex
} from './route';

/** The page's route of waystones and the bar's state: where you are, and flying between them. */
export class WaystonesState {
	/** Index in `route` of the waystone last flown to (-1: none yet on this page). */
	current = $state(-1);
	listOpen = $state(false);
	/** Presenting: full screen, the board's interface hidden except the waystone bar. */
	presenting = $state(false);
	wrap = $state(getPref<boolean>('waystones:wrap', true) !== false);
	readonly #ctx: BoardContext;

	constructor(ctx: BoardContext) {
		this.#ctx = ctx;
	}

	get route(): WaystoneElement[] {
		void this.#ctx.store.version;
		return routeOf(this.#ctx.store.elements.values());
	}

	setWrap(on: boolean): void {
		this.wrap = on;
		setPref('waystones:wrap', on);
	}

	/** Flies to the waystone at `index` (centred at its zoom). */
	go(index: number): void {
		const w = this.route[index];
		if (!w) return;
		this.current = index;
		this.#ctx.viewport.animateTo(flyTarget(w, this.#ctx.viewport.size), 450);
	}

	step(dir: 1 | -1): void {
		const route = this.route;
		const i = stepIndex(Math.min(this.current, route.length - 1), route.length, dir, this.wrap);
		if (i !== null) this.go(i);
	}

	/** A new waystone with its tip at `at` (default: the view centre), arriving at the current zoom. */
	add(at?: Point): string {
		const { doc, viewport, undo } = this.#ctx;
		const tip = at ?? screenToWorld(viewport.vp, viewport.center);
		const route = this.route;
		const id = newId();
		undo.stopCapturing();
		createElements(doc, [
			{
				id,
				type: 'waystone',
				...boxAt(tip),
				rotation: 0,
				parentId: null,
				groupId: null,
				locked: false,
				style: baseStyleFor('waystone'),
				name: `Tab ${route.length + 1}`,
				zoom: clampWaystoneZoom(viewport.zoom),
				order: orderAfter(route)
			}
		]);
		undo.stopCapturing();
		this.current = route.length;
		return id;
	}

	rename(id: string, name: string): void {
		this.#write(() => updateElement(this.#ctx.doc, id, { name: name.trim().slice(0, 100) }));
	}

	/** Moves a waystone `delta` places along the route. */
	move(id: string, to: number): void {
		const route = this.route;
		const from = route.findIndex((w) => w.id === id);
		if (from < 0) return;
		const order = orderForMove(route, from, to);
		if (order) this.#write(() => updateElement(this.#ctx.doc, id, { order }));
	}

	/** Points a tab at what's on screen now: the view centre, at the current zoom. */
	updateView(id: string): void {
		const { doc, viewport } = this.#ctx;
		const tip = screenToWorld(viewport.vp, viewport.center);
		const zoom = clampWaystoneZoom(viewport.zoom);
		this.#write(() => updateElement(doc, id, { ...boxAt(tip), zoom }));
	}

	remove(id: string): void {
		this.#write(() => deleteElements(this.#ctx.doc, [id]));
	}

	present(): void {
		this.presenting = true;
		this.listOpen = false;
		if (fullscreen.supported && !fullscreen.active) fullscreen.toggle();
		this.go(Math.max(0, Math.min(this.current, this.route.length - 1)));
	}

	stopPresenting(): void {
		this.presenting = false;
		if (fullscreen.active) fullscreen.toggle();
	}

	/** The route was left (page switch): start again from the first. */
	reset(): void {
		this.current = -1;
		this.listOpen = false;
	}

	#write(fn: () => void): void {
		this.#ctx.undo.stopCapturing();
		fn();
		this.#ctx.undo.stopCapturing();
	}
}
