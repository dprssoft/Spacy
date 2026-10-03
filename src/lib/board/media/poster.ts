import type { MediaElement } from '$lib/model/types';

/** 75 → "1:15", 3725 → "1:02:05". */
export function formatTime(seconds: number): string {
	const s = Math.max(0, Math.floor(seconds));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const ss = String(s % 60).padStart(2, '0');
	return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

const PROVIDER_LABEL: Record<MediaElement['provider'], string> = {
	youtube: 'YouTube',
	vimeo: 'Vimeo',
	video: 'Video',
	audio: 'Audio'
};

/** What the poster says under the title: provider · host, and the clip when one is set. */
export function posterSubtitle(el: MediaElement): string {
	let host = '';
	try {
		host = new URL(el.url).hostname.replace(/^www\./, '');
	} catch {
		// Validated on write; a bad URL just shows no host.
	}
	const parts = [PROVIDER_LABEL[el.provider]];
	if (host && el.provider !== 'youtube' && el.provider !== 'vimeo') parts.push(host);
	if (el.end !== null) parts.push(`${formatTime(el.start)}–${formatTime(el.end)}`);
	else if (el.start > 0) parts.push(`from ${formatTime(el.start)}`);
	return parts.join(' · ');
}
