import { newId } from './ids';
import type { Element, NewElement, Point } from './types';

/**
 * Post-processing for cloned elements, e.g. remapping connector endpoints (step 20).
 * Receives the clone (new id, offset applied) and the complete old → new id map.
 */
export const cloneHooks: ((el: NewElement, idMap: ReadonlyMap<string, string>) => NewElement)[] =
	[];

/**
 * Copies elements with new ids, shifted by `offset`. Groups get new group ids; parents are
 * remapped when cloned too, otherwise kept. Clones have no `z`, so callers assign fresh keys.
 */
export function cloneElements(
	els: readonly Element[],
	opts: { offset: Point; idMap?: Map<string, string> }
): { elements: NewElement[]; idMap: Map<string, string> } {
	const idMap = opts.idMap ?? new Map<string, string>();
	for (const el of els) if (!idMap.has(el.id)) idMap.set(el.id, newId());
	const groupMap = new Map<string, string>();

	const elements = els.map((el) => {
		const { z: _z, ...rest } = structuredClone(el);
		let clone: NewElement = {
			...rest,
			id: idMap.get(el.id) ?? newId(),
			x: el.x + opts.offset.x,
			y: el.y + opts.offset.y,
			parentId: el.parentId === null ? null : (idMap.get(el.parentId) ?? el.parentId),
			groupId: el.groupId === null ? null : remapGroup(el.groupId, groupMap)
		};
		for (const hook of cloneHooks) clone = hook(clone, idMap);
		return clone;
	});
	return { elements, idMap };
}

function remapGroup(groupId: string, groupMap: Map<string, string>): string {
	let next = groupMap.get(groupId);
	if (!next) {
		next = newId();
		groupMap.set(groupId, next);
	}
	return next;
}
