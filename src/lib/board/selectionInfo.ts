import type { Element } from '$lib/model/types';
import type { BoardContext } from './context';
import { definitionOf } from './elements';
import { selectionBox, type Box } from './engine/transform';

/** Selected elements that transforms apply to: unlocked, not connectors (their geometry is derived). */
export function transformTargets(ctx: BoardContext): Element[] {
	const out: Element[] = [];
	for (const id of ctx.selection.ids) {
		const el = ctx.store.get(id);
		if (el && !el.locked && el.type !== 'connector') out.push(el);
	}
	return out;
}

export function targetsBox(targets: readonly Element[]): Box | null {
	return selectionBox(targets, (el) => definitionOf(el).aabb(el));
}

export function handleOptions(targets: readonly Element[]): { resize: boolean; rotate: boolean } {
	if (targets.length === 0) return { resize: false, rotate: false };
	const defs = targets.map(definitionOf);
	return {
		resize: targets.length === 1 ? defs[0]!.resizable : defs.some((d) => d.resizable),
		rotate: defs.every((d) => d.rotatable)
	};
}

/** Ids of an element's whole group (just the element when ungrouped or when its group is entered). */
export function groupOf(ctx: BoardContext, el: Element): string[] {
	if (!el.groupId || ctx.selection.enteredGroup === el.groupId) return [el.id];
	const ids: string[] = [];
	for (const other of ctx.store.elements.values())
		if (other.groupId === el.groupId) ids.push(other.id);
	return ids;
}
