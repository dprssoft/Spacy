import { getElementsMap, listElements } from '$lib/model/doc';
import { createElements, deleteElements } from '$lib/model/ops';
import type { Element, NewElement } from '$lib/model/types';
import { getPref } from '$lib/shared/localPrefs';
import type { BoardContext } from '$lib/board/context';
import { keyboard } from '$lib/shared/keyboard.svelte';
import { createMixedPerfBoard, generatePerfElements } from './perfBoard';

export interface TestHooks {
	ctx: BoardContext;
	createElements(els: NewElement[]): Element[];
	list(): Element[];
	clear(): void;
	/** Adds `n` generated elements (performance testing). */
	perf(n?: number, seed?: number): number;
	/** Adds a realistic mix of `n` elements (strokes, doc cards, frames, images, connectors). */
	perfMixed(n?: number, seed?: number): Promise<number>;
	/** How often each element's view has rendered (to check that edits re-render only what changed). */
	renderCounts: Map<string, number>;
	/** Pretends an on-screen keyboard of `px` is open (null: measure again). */
	keyboard(px: number | null): void;
	/** Time spent in instrumented hot paths (for the perf benchmark). */
	timings: Map<string, Timing>;
}

export interface Timing {
	ms: number;
	calls: number;
}

// Shared by all ElementViews; only filled while test hooks are enabled.
export const renderCounts = new Map<string, number>();
let counting = false;

export const timings = new Map<string, Timing>();

/** Runs `fn`, adding its duration to `timings` under `name` while hooks are enabled. */
export function timed<T>(name: string, fn: () => T): T {
	if (!counting) return fn();
	const t0 = performance.now();
	try {
		return fn();
	} finally {
		const t = timings.get(name) ?? { ms: 0, calls: 0 };
		t.ms += performance.now() - t0;
		t.calls++;
		timings.set(name, t);
	}
}

/** Called by ElementView on every render of an element. A no-op unless hooks are enabled. */
export function countRender(id: string): void {
	if (counting) renderCounts.set(id, (renderCounts.get(id) ?? 0) + 1);
}

export function testHooksEnabled(): boolean {
	return import.meta.env.DEV || getPref<boolean>('testHooks', false) === true;
}

/**
 * Exposes the board on `window.__spacy` in dev, or in any build when
 * localStorage `spacy:testHooks` is `true` (used by e2e tests). Returns cleanup.
 */
export function installTestHooks(ctx: BoardContext): () => void {
	if (!testHooksEnabled()) return () => {};
	const hooks: TestHooks = {
		ctx,
		createElements: (els) => createElements(ctx.doc, els),
		list: () => listElements(ctx.doc),
		clear: () => deleteElements(ctx.doc, [...getElementsMap(ctx.doc).keys()]),
		perf: (n = 3000, seed = 1) => createElements(ctx.doc, generatePerfElements(n, seed)).length,
		perfMixed: (n = 3000, seed = 1) => createMixedPerfBoard(ctx.doc, ctx.id, n, seed),
		renderCounts,
		timings,
		keyboard: (px) => keyboard.simulate(px)
	};
	counting = true;
	window.__spacy = hooks;
	return () => {
		counting = false;
		renderCounts.clear();
		timings.clear();
		if (window.__spacy === hooks) delete window.__spacy;
	};
}
