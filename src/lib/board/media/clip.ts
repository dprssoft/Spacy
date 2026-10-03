/** Clip rules (pure): where playback starts and what happens at the clip's end. */

export interface Clip {
	start: number;
	end: number | null;
	loop: boolean;
}

/** How close to the end counts as the end (time updates come a few times a second). */
const END_SLACK = 0.25;

/** Clamps a clip to the media: 0 ≤ start < end ≤ duration (a zero duration means unknown). */
export function clampClip(clip: Clip, duration: number): { start: number; end: number | null } {
	const max = duration > 0 ? duration : Infinity;
	const start = Math.min(
		Math.max(0, clip.start),
		Number.isFinite(max) ? Math.max(0, max - 1) : clip.start
	);
	let end = clip.end === null ? null : Math.min(clip.end, max);
	if (end !== null && end <= start) end = null;
	return { start, end };
}

/**
 * What to do at `time`: nothing, stop at the clip's end, or jump back to its start (loop).
 * `ended` is true when the player reported the media's own end.
 */
export function clipAction(
	time: number,
	duration: number,
	clip: Clip,
	ended = false
): 'none' | 'stop' | 'restart' {
	const { end } = clampClip(clip, duration);
	const limit = end ?? (duration > 0 ? duration : Infinity);
	const atEnd = ended || time >= limit - END_SLACK;
	if (!atEnd) return 'none';
	return clip.loop ? 'restart' : end !== null ? 'stop' : 'none';
}
