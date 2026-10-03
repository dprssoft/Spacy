import { clampClip, clipAction, type Clip } from './clip';
import type { MediaController } from './controller';
import { readMediaPrefs } from './mediaPrefs';

/**
 * Runs a player under the board's rules: applies the personal volume/speed once it's ready and
 * enforces the clip (stop at its end, or loop back to its start). Returns stop.
 */
export function runSession(c: MediaController, clip: () => Clip): () => void {
	let applied = false;
	let restartedAt = -Infinity;
	return c.subscribe(() => {
		const s = c.state;
		if (s.ready && !applied) {
			applied = true;
			const prefs = readMediaPrefs();
			c.setVolume(prefs.volume);
			c.setMuted(prefs.muted);
			if (c.can.rate && prefs.rate !== 1) c.setRate(prefs.rate);
		}
		const action = clipAction(s.time, s.duration, clip(), s.ended);
		const now = Date.now();
		// A seek takes a moment to show up in time updates: don't restart twice for one end.
		if (action === 'restart' && now - restartedAt > 800) {
			restartedAt = now;
			c.seek(clampClip(clip(), s.duration).start);
			c.play();
		} else if (action === 'stop' && s.playing) {
			c.pause();
		}
	});
}

/** Play, starting over from the clip's start when sitting at (or past) its end. */
export function playInClip(c: MediaController, clip: Clip): void {
	const { start, end } = clampClip(clip, c.state.duration);
	const limit = end ?? c.state.duration;
	if (c.state.ended || (limit > 0 && c.state.time >= limit - 0.25) || c.state.time < start - 0.5)
		c.seek(start);
	c.play();
}
