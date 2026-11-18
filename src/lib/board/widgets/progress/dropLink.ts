import type { BoardStore } from '../../boardStore.svelte';
import { progressKind } from './progress';

/**
 * A progress widget dropped on a doc card counts that card's checklist: the config to write, or
 * null when it's not a progress widget, not over a card, or already linked to it.
 */
export function linkOnDrop(store: BoardStore, widgetId: string): unknown {
	const el = store.get(widgetId);
	if (el?.type !== 'widget' || el.kind !== 'progress' || el.locked) return null;
	const center = { x: el.x + el.w / 2, y: el.y + el.h / 2 };
	const card = store.index
		.near(center, 0)
		.map((id) => store.get(id))
		.find(
			(c) =>
				c?.type === 'doccard' &&
				center.x >= c.x &&
				center.x <= c.x + c.w &&
				center.y >= c.y &&
				center.y <= c.y + c.h
		);
	if (!card) return null;
	const config = progressKind.parseConfig(el.config);
	if (config.source === 'checklist' && config.cardId === card.id) return null;
	return { ...config, source: 'checklist', cardId: card.id };
}
