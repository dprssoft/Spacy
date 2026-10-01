import type { Element } from '$lib/model/types';
import { endpointElementId } from './endpoints';

/** element id → ids of connectors attached to it (non-reactive bookkeeping for the board store). */
export class ConnectorIndex {
	#attached = new Map<string, Set<string>>();

	add(c: Element | undefined): void {
		if (c?.type !== 'connector') return;
		for (const ep of [c.from, c.to]) {
			const target = endpointElementId(ep);
			if (!target) continue;
			let set = this.#attached.get(target);
			if (!set) this.#attached.set(target, (set = new Set()));
			set.add(c.id);
		}
	}

	remove(c: Element | undefined): void {
		if (c?.type !== 'connector') return;
		for (const ep of [c.from, c.to]) {
			const target = endpointElementId(ep);
			if (target) this.#attached.get(target)?.delete(c.id);
		}
	}

	of(elementId: string): string[] {
		return [...(this.#attached.get(elementId) ?? [])];
	}
}
