import type { MediaProvider } from '$lib/model/types';

export interface ParsedMedia {
	provider: MediaProvider;
	mediaId: string | null;
	start: number;
	title: string;
}

const VIDEO_EXT = ['mp4', 'webm', 'ogv', 'mov', 'm4v'];
const AUDIO_EXT = ['mp3', 'ogg', 'oga', 'wav', 'm4a', 'aac', 'flac', 'opus'];
const YOUTUBE_ID = /^[\w-]{11}$/;
const VIMEO_ID = /^\d{1,12}$/;

/** "90", "90s", "1m30s", "1h2m3s" → seconds (0 when absent or invalid). */
export function parseTime(value: string | null | undefined): number {
	if (!value) return 0;
	if (/^\d+(\.\d+)?$/.test(value)) return Math.floor(Number(value));
	const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
	if (!m || !value) return 0;
	return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

const host = (u: URL) => u.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, '');

function fileName(u: URL): string {
	const last = decodeURIComponent(u.pathname.split('/').pop() ?? '');
	return last || u.hostname;
}

/**
 * Recognizes a YouTube or Vimeo link, or a link to an audio/video file. Only https URLs are
 * accepted; anything else returns null.
 */
export function parseMediaUrl(input: string): ParsedMedia | null {
	let u: URL;
	try {
		u = new URL(input.trim());
	} catch {
		return null;
	}
	if (u.protocol !== 'https:' || u.username || u.password) return null;
	const h = host(u);
	const parts = u.pathname.split('/').filter(Boolean);

	if (h === 'youtube.com' || h === 'youtube-nocookie.com' || h === 'youtu.be') {
		let id: string | undefined;
		if (h === 'youtu.be') id = parts[0];
		else if (parts[0] === 'watch') id = u.searchParams.get('v') ?? undefined;
		else if (['shorts', 'embed', 'live', 'v'].includes(parts[0] ?? '')) id = parts[1];
		if (!id || !YOUTUBE_ID.test(id)) return null;
		const start = parseTime(u.searchParams.get('t') ?? u.searchParams.get('start'));
		return { provider: 'youtube', mediaId: id, start, title: 'YouTube video' };
	}

	if (h === 'vimeo.com' || h === 'player.vimeo.com') {
		const id =
			h === 'player.vimeo.com'
				? parts[0] === 'video'
					? parts[1]
					: undefined
				: parts.find((p) => VIMEO_ID.test(p));
		if (!id || !VIMEO_ID.test(id)) return null;
		const t = /(?:^|&)t=([\dhms.]+)/.exec(u.hash.slice(1))?.[1];
		return { provider: 'vimeo', mediaId: id, start: parseTime(t), title: 'Vimeo video' };
	}

	const ext = /\.([a-z0-9]+)$/i.exec(u.pathname)?.[1]?.toLowerCase() ?? '';
	const start = parseTime(/(?:^|&)t=([\d.]+)/.exec(u.hash.slice(1))?.[1]);
	if (VIDEO_EXT.includes(ext))
		return { provider: 'video', mediaId: null, start, title: fileName(u) };
	if (AUDIO_EXT.includes(ext))
		return { provider: 'audio', mediaId: null, start, title: fileName(u) };
	return null;
}

/** The player URL for an embed (built from the id only, never from the stored link). */
export function embedUrl(provider: 'youtube' | 'vimeo', id: string, start: number): string {
	const s = Math.max(0, Math.floor(start));
	if (provider === 'youtube') {
		const q = new URLSearchParams({ autoplay: '1', rel: '0', playsinline: '1' });
		if (s) q.set('start', String(s));
		return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${q}`;
	}
	return `https://player.vimeo.com/video/${encodeURIComponent(id)}?dnt=1&autoplay=1${s ? `#t=${s}s` : ''}`;
}

/** A shareable link to the media at `seconds` (YouTube/Vimeo understand t=). */
export function linkAt(url: string, provider: MediaProvider, seconds: number): string {
	const s = Math.max(0, Math.floor(seconds));
	try {
		const u = new URL(url);
		if (provider === 'youtube') {
			u.searchParams.delete('start');
			if (s) u.searchParams.set('t', String(s));
			else u.searchParams.delete('t');
		} else if (s) u.hash = `t=${s}`;
		return u.toString();
	} catch {
		return url;
	}
}
