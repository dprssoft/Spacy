import { getElementsMap, listElements } from '$lib/model/doc';
import { createElements, deleteElements } from '$lib/model/ops';
import type { Element, NewElement } from '$lib/model/types';
import { getPref } from '$lib/shared/localPrefs';
import type { BoardContext } from '$lib/board/context';
import { generatePerfElements } from './perfBoard';

export interface TestHooks {
	ctx: BoardContext;
	createElements(els: NewElement[]): Element[];
	list(): Element[];
	clear(): void;
	/** Adds `n` generated elements (performance testing). */
	perf(n?: number, seed?: number): number;
}

export function testHooksEnabled(): boolean {
	return import.meta.env.DEV || getPref<boolean>('testHooks', false) === true;
}

/**
 * Exposes the board on `window.__smthng` in dev, or in any build when
 * localStorage `smthng:testHooks` is `true` (used by e2e tests). Returns cleanup.
 */
export function installTestHooks(ctx: BoardContext): () => void {
	if (!testHooksEnabled()) return () => {};
	const hooks: TestHooks = {
		ctx,
		createElements: (els) => createElements(ctx.doc, els),
		list: () => listElements(ctx.doc),
		clear: () => deleteElements(ctx.doc, [...getElementsMap(ctx.doc).keys()]),
		perf: (n = 3000, seed = 1) => createElements(ctx.doc, generatePerfElements(n, seed)).length
	};
	window.__smthng = hooks;
	return () => {
		if (window.__smthng === hooks) delete window.__smthng;
	};
}
