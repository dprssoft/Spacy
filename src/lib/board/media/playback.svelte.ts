import { SvelteSet } from 'svelte/reactivity';

/**
 * Which media elements are playing (local to this tab, never stored). Playing elements stay
 * mounted when scrolled out of view or zoomed far out, so leaving them doesn't cut the sound.
 */
export class PlaybackState {
	readonly playing = new SvelteSet<string>();

	play(id: string): void {
		this.playing.add(id);
	}

	stop(id: string): void {
		this.playing.delete(id);
	}

	toggle(id: string): void {
		if (this.playing.has(id)) this.stop(id);
		else this.play(id);
	}

	stopAll(): void {
		this.playing.clear();
	}

	/** Forgets elements that no longer exist (deleted here, in another tab, or by undo). */
	prune(exists: (id: string) => boolean): void {
		for (const id of this.playing) if (!exists(id)) this.playing.delete(id);
	}
}
