import type { MediaElement } from '$lib/model/types';
import type { BoardContext } from '../context';
import * as cmd from './commands';
import type { MediaController } from './controller';

/**
 * The media element keys control: the one being interacted with, or the single selected one
 * while it's playing (then its keys win over tool shortcuts and arrow nudging).
 */
export function mediaKeyTarget(ctx: BoardContext): { el: MediaElement; c: MediaController } | null {
	const id = ctx.selection.editingId ?? ctx.selection.single;
	const el = id ? ctx.store.get(id) : undefined;
	if (el?.type !== 'media') return null;
	const c = ctx.playback.controllers.get(el.id);
	return c ? { el, c } : null;
}

/** Handles a media key; returns true when it was one. */
export function handleMediaKey(ctx: BoardContext, e: KeyboardEvent): boolean {
	if (e.ctrlKey || e.metaKey || e.altKey) return false;
	const target = mediaKeyTarget(ctx);
	if (!target) return false;
	const { el, c } = target;
	const key = e.key;
	if (key === ' ' || key === 'k' || key === 'K') cmd.togglePlay(c, el);
	else if (key === 'j' || key === 'J') cmd.seekBy(c, -10);
	else if (key === 'l') cmd.seekBy(c, 10);
	else if (key === 'L') cmd.toggleLoop(ctx, el);
	else if (key === 'ArrowLeft') cmd.seekBy(c, -5);
	else if (key === 'ArrowRight') cmd.seekBy(c, 5);
	else if (key === 'ArrowUp') cmd.setVolume(c, (c.state.muted ? 0 : c.state.volume) + 0.05);
	else if (key === 'ArrowDown') cmd.setVolume(c, (c.state.muted ? 0 : c.state.volume) - 0.05);
	else if (key === 'm' || key === 'M') cmd.setMuted(c, !c.state.muted);
	else if ((key === 'f' || key === 'F') && el.provider !== 'audio') cmd.toggleFullscreen(el.id);
	else if (key === '<') cmd.stepRate(c, -1);
	else if (key === '>') cmd.stepRate(c, 1);
	else if (/^[0-9]$/.test(key) && c.state.duration > 0)
		c.seek((Number(key) / 10) * c.state.duration);
	else if (key === 'Home') c.seek(el.start);
	else if (key === 'End') c.seek(el.end ?? Math.max(0, c.state.duration - 0.5));
	else return false;
	return true;
}
