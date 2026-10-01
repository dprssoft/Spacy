import type { Element } from '$lib/model/types';
import type { BoardStore } from '../boardStore.svelte';
import { definitionOf } from '../elements';
import type { DiagramWorld } from './endpoints';

/** The board as seen by diagram geometry (keeps the pure diagram modules free of the registry). */
export function boardWorld(get: (id: string) => Element | undefined): DiagramWorld {
	return { get, connectable: (el) => definitionOf(el).connectable };
}

export const storeWorld = (store: BoardStore): DiagramWorld => boardWorld((id) => store.get(id));
