import { LOCAL } from '$lib/model/origins';
import { debounce } from '$lib/shared/debounce';
import * as boardsRepo from '$lib/storage/boardsRepo';
import type { BoardContext } from '../context';

const IDLE_MS = 10_000;
type Renderer = (ctx: BoardContext) => Promise<Blob | null>;

/**
 * Keeps the start-page thumbnail fresh: 10 s after the last local edit, when the tab is hidden,
 * and when the board is closed (fire and forget). Returns cleanup.
 */
export function trackThumbnail(ctx: BoardContext): () => void {
	let dirty = false;
	// The renderer loads after the first edit, so it's ready (and can read the board
	// synchronously) by the time the board closes.
	let renderer: Renderer | null = null;
	let loading: Promise<Renderer> | null = null;
	const load = () =>
		(loading ??= import('./thumbnails').then((m) => (renderer = m.renderThumbnail)));
	const run = (render: Renderer) =>
		void render(ctx)
			.then((blob) => (blob ? boardsRepo.setThumbnail(ctx.id, blob) : undefined))
			.catch((err: unknown) => console.error('Thumbnail failed', err));
	const save = () => {
		if (!dirty) return;
		dirty = false;
		if (renderer) run(renderer);
		else void load().then(run);
	};
	const later = debounce(save, IDLE_MS);
	const onUpdate = (_u: Uint8Array, origin: unknown) => {
		if (origin !== LOCAL) return;
		dirty = true;
		void load();
		later();
	};
	const onVisibility = () => {
		if (document.visibilityState === 'hidden') {
			later.cancel();
			save();
		}
	};
	ctx.doc.on('update', onUpdate);
	document.addEventListener('visibilitychange', onVisibility);
	return () => {
		ctx.doc.off('update', onUpdate);
		document.removeEventListener('visibilitychange', onVisibility);
		later.cancel();
		save();
	};
}
