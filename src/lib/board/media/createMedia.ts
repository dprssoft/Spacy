import { MEDIA_AUDIO_SIZE, newElementBase } from '$lib/model/defaults';
import { newId } from '$lib/model/ids';
import { createElements } from '$lib/model/ops';
import type { Point } from '$lib/model/types';
import type { BoardContext } from '../context';
import { syncFrameMembership } from '../frameMembership';
import { getDefaultStyle } from '../style/styleDefaults';
import { parseMediaUrl } from './parseMediaUrl';

/** The media link in dropped or pasted text: one supported URL and nothing else. */
export function mediaLinkIn(text: string | null | undefined): string | null {
	const value = text?.trim() ?? '';
	if (!value || /\s/.test(value)) return null;
	return parseMediaUrl(value) ? value : null;
}

/** The media link carried by a drag (a link dragged from a page or the address bar). */
export function droppedMediaLink(dt: DataTransfer | null): string | null {
	if (!dt) return null;
	const uris = dt
		.getData('text/uri-list')
		.split(/\r?\n/)
		.filter((l) => l && !l.startsWith('#'));
	return mediaLinkIn(uris[0]) ?? mediaLinkIn(dt.getData('text/plain'));
}

/**
 * Adds a media element for `url` centered on `at` (one undo step) and selects it. Returns its id,
 * or null when the link isn't a supported media link.
 */
export function createMedia(ctx: BoardContext, url: string, at: Point): string | null {
	const parsed = parseMediaUrl(url);
	if (!parsed) return null;
	const id = newId();
	const size = parsed.provider === 'audio' ? MEDIA_AUDIO_SIZE : undefined;
	const base = newElementBase('media', id, at, getDefaultStyle('media'));
	ctx.undo.stopCapturing();
	createElements(ctx.doc, [
		{
			...base,
			...(size && { x: at.x - size.w / 2, y: at.y - size.h / 2, ...size }),
			type: 'media',
			url: url.trim(),
			provider: parsed.provider,
			mediaId: parsed.mediaId,
			start: parsed.start,
			end: null,
			loop: false,
			title: parsed.title.slice(0, 200)
		}
	]);
	syncFrameMembership(ctx, [id]);
	ctx.undo.stopCapturing();
	ctx.tools.setTool('select');
	ctx.selection.set([id]);
	return id;
}
