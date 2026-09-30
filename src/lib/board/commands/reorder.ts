import type { Rect } from '$lib/model/types';
import { compareZ, zBetween, zManyAbove, zManyBelow } from '$lib/model/zorder';
import { rectsIntersect } from '../engine/geometry';

export interface Layered {
	id: string;
	z: string;
	rect: Rect;
}

export type ReorderOp = 'front' | 'back' | 'forward' | 'backward';

/**
 * New z keys for the selected items of one layer (frames and other elements are separate layers).
 * - front/back: to the top/bottom, keeping their relative order.
 * - forward/backward: past the nearest unselected item that overlaps them; nothing if none does.
 */
export function reorder(
	items: readonly Layered[],
	selected: ReadonlySet<string>,
	op: ReorderOp
): Map<string, string> {
	const order = [...items].sort((a, b) => compareZ(a.z, b.z));
	const chosen = order.filter((it) => selected.has(it.id));
	const out = new Map<string, string>();
	if (chosen.length === 0) return out;

	if (op === 'front' || op === 'back') {
		const others = order.filter((it) => !selected.has(it.id));
		if (others.length === 0) return out;
		const keys =
			op === 'front'
				? zManyAbove(others[others.length - 1]!.z, chosen.length)
				: zManyBelow(others[0]!.z, chosen.length);
		chosen.forEach((it, i) => out.set(it.id, keys[i]!));
		return out;
	}

	// forward: topmost first, so several items passing the same neighbour keep their order.
	const list = order.map((it) => ({ ...it }));
	const seq = op === 'forward' ? [...chosen].reverse() : chosen;
	for (const item of seq) {
		const idx = list.findIndex((it) => it.id === item.id);
		const step = op === 'forward' ? 1 : -1;
		let j = idx + step;
		while (j >= 0 && j < list.length) {
			const o = list[j]!;
			if (!selected.has(o.id) && rectsIntersect(o.rect, item.rect)) break;
			j += step;
		}
		if (j < 0 || j >= list.length) continue;
		const o = list[j]!;
		const beyond = list[j + step];
		const z =
			op === 'forward' ? zBetween(o.z, beyond?.z ?? null) : zBetween(beyond?.z ?? null, o.z);
		const [moved] = list.splice(idx, 1);
		moved!.z = z;
		// Re-insert right past `o` (indices shift after the splice when moving forward).
		const at = list.findIndex((it) => it.id === o.id) + (op === 'forward' ? 1 : 0);
		list.splice(at, 0, moved!);
		out.set(item.id, z);
	}
	return out;
}
