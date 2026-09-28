import type { Point } from '$lib/model/types';
import type { HandleId } from './types';

/**
 * Screen-space handle hit tests (selection handles, connector ports…), checked before elements.
 * Providers register themselves and return an unregister function.
 */
export class HandleRegistry {
	#providers = new Set<(screen: Point) => HandleId | null>();

	register(provider: (screen: Point) => HandleId | null): () => void {
		this.#providers.add(provider);
		return () => this.#providers.delete(provider);
	}

	hit(screen: Point): HandleId | null {
		for (const provider of this.#providers) {
			const h = provider(screen);
			if (h) return h;
		}
		return null;
	}
}
