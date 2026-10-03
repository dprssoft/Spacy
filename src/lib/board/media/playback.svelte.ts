import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { MediaController } from './controller';
import { readMediaPrefs } from './mediaPrefs';

/**
 * Which media elements are playing (local to this tab, never stored). Playing elements stay
 * mounted when scrolled out of view or zoomed far out, so leaving them doesn't cut the sound.
 */
export class PlaybackState {
	readonly playing = new SvelteSet<string>();
	/** The live player of each playing element, once it's mounted. */
	readonly controllers = new SvelteMap<string, MediaController>();
	/** Players that didn't answer: they show their own controls instead of ours. */
	readonly fallback = new SvelteSet<string>();

	play(id: string): void {
		// One at a time (a personal setting, on by default): the others pause.
		if (readMediaPrefs().oneAtATime) this.pauseOthers(id);
		if (this.playing.has(id)) this.controllers.get(id)?.play();
		this.playing.add(id);
	}

	/** Pauses every playing element except `id` (they stay mounted, paused). */
	pauseOthers(id: string): void {
		for (const [other, c] of this.controllers) if (other !== id && c.state.playing) c.pause();
	}

	stop(id: string): void {
		this.playing.delete(id);
		this.fallback.delete(id);
	}

	register(id: string, c: MediaController): () => void {
		this.controllers.set(id, c);
		// Whatever starts it (our controls, autoplay, the player's own button), one plays at a time.
		let wasPlaying = c.state.playing;
		const unwatch = c.subscribe(() => {
			if (c.state.playing && !wasPlaying && readMediaPrefs().oneAtATime) this.pauseOthers(id);
			wasPlaying = c.state.playing;
		});
		return () => {
			unwatch();
			if (this.controllers.get(id) === c) this.controllers.delete(id);
		};
	}

	toggle(id: string): void {
		if (this.playing.has(id)) this.stop(id);
		else this.play(id);
	}

	stopAll(): void {
		this.playing.clear();
		this.fallback.clear();
	}

	/** Forgets elements that no longer exist (deleted here, in another tab, or by undo). */
	prune(exists: (id: string) => boolean): void {
		for (const id of this.playing) if (!exists(id)) this.playing.delete(id);
	}
}
