import { toast } from 'svelte-sonner';
import type { BoardContext } from '../context';
import { definitionOf } from '../elements';
import { nearestRect } from '../engine/nearest';
import { fitRect, screenToWorld } from '../engine/viewport';

let pulses = 0;

/**
 * Flies to the object nearest the centre of the view (not waystones or connectors), for getting
 * back from empty space. Pressed again, it moves on to the next nearest. Returns its id.
 */
export function goToNearest(ctx: BoardContext): string | null {
	const { store, viewport } = ctx;
	const candidates = [...store.elements.values()]
		.filter((el) => el.type !== 'waystone' && el.type !== 'connector')
		.map((el) => ({ id: el.id, rect: definitionOf(el).aabb(el, store.world) }));
	const centre = screenToWorld(viewport.vp, viewport.center);
	const hit = nearestRect(candidates, centre, 2 / viewport.zoom);
	if (!hit) {
		toast(candidates.length ? 'Already there' : 'Nothing on this page yet');
		return null;
	}
	// Never zooms in past 100 % (or the current zoom, if closer); zooms out if it doesn't fit.
	viewport.animateTo(fitRect(hit.rect, viewport.size, 64, Math.max(viewport.zoom, 1)), 400);
	ctx.preview.pulse = { id: hit.id, n: ++pulses };
	return hit.id;
}
