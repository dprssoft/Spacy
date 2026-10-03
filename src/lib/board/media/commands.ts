import { updateElement } from '$lib/model/ops';
import type { MediaElement } from '$lib/model/types';
import type { BoardContext } from '../context';
import { clampClip } from './clip';
import type { MediaController } from './controller';
import { RATES, writeMediaPrefs } from './mediaPrefs';
import { linkAt } from './parseMediaUrl';
import { playInClip } from './session';

// What the controls bar and the keyboard do; clip and loop are board data (undoable), volume and
// speed are personal settings.

export function togglePlay(c: MediaController, el: MediaElement): void {
	if (c.state.playing) c.pause();
	else playInClip(c, el);
}

export function seekBy(c: MediaController, seconds: number): void {
	const d = c.state.duration;
	const t = c.state.time + seconds;
	c.seek(Math.max(0, d > 0 ? Math.min(t, d - 0.1) : t));
}

export function setVolume(c: MediaController, volume: number): void {
	const v = Math.min(1, Math.max(0, volume));
	c.setVolume(v);
	if (v > 0 && c.state.muted) c.setMuted(false);
	writeMediaPrefs({ volume: v, muted: v > 0 ? false : c.state.muted });
}

export function setMuted(c: MediaController, muted: boolean): void {
	c.setMuted(muted);
	writeMediaPrefs({ muted });
}

export function setRate(c: MediaController, rate: number): void {
	c.setRate(rate);
	writeMediaPrefs({ rate });
}

/** The next speed up (1) or down (-1) from the list. */
export function stepRate(c: MediaController, dir: 1 | -1): void {
	const i = RATES.findIndex((r) => r >= c.state.rate - 0.001);
	const next =
		RATES[Math.min(RATES.length - 1, Math.max(0, (i < 0 ? RATES.length - 1 : i) + dir))]!;
	setRate(c, next);
}

function write(ctx: BoardContext, el: MediaElement, patch: Partial<MediaElement>): void {
	ctx.undo.stopCapturing();
	updateElement(ctx.doc, el.id, patch);
	ctx.undo.stopCapturing();
}

export function toggleLoop(ctx: BoardContext, el: MediaElement): void {
	write(ctx, el, { loop: !el.loop });
}

/** Clip start/end at the current time (clamped so start < end). */
export function setClipEdge(
	ctx: BoardContext,
	el: MediaElement,
	c: MediaController,
	edge: 'start' | 'end'
): void {
	const t = Math.round(c.state.time * 10) / 10;
	const d = c.state.duration;
	if (edge === 'start') {
		const end = el.end !== null && el.end <= t ? null : el.end;
		write(ctx, el, { start: clampClip({ start: t, end, loop: el.loop }, d).start, end });
	} else {
		if (t <= el.start) return;
		write(ctx, el, { end: d > 0 ? Math.min(t, d) : t });
	}
}

export function clearClip(ctx: BoardContext, el: MediaElement): void {
	write(ctx, el, { start: 0, end: null });
}

export function copyLinkAt(el: MediaElement, c: MediaController | undefined): void {
	void navigator.clipboard?.writeText(linkAt(el.url, el.provider, c?.state.time ?? 0));
}

/** The element's player box (fullscreen target). */
export function mediaBox(id: string): HTMLElement | null {
	return document.querySelector<HTMLElement>(`[data-element-id="${CSS.escape(id)}"] [data-media]`);
}

export function toggleFullscreen(id: string): void {
	const box = mediaBox(id);
	if (!box) return;
	if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
	else void box.requestFullscreen?.().catch(() => {});
}
