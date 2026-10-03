import { describe, expect, it } from 'vitest';
import { embedUrl, linkAt, parseMediaUrl, parseTime } from './parseMediaUrl';

const ID = 'dQw4w9WgXcQ';

describe('parseMediaUrl: YouTube', () => {
	it.each([
		`https://www.youtube.com/watch?v=${ID}`,
		`https://youtube.com/watch?v=${ID}&list=abc`,
		`https://m.youtube.com/watch?v=${ID}`,
		`https://music.youtube.com/watch?v=${ID}`,
		`https://youtu.be/${ID}`,
		`https://www.youtube.com/shorts/${ID}`,
		`https://www.youtube.com/embed/${ID}`,
		`https://www.youtube.com/live/${ID}`,
		`https://www.youtube-nocookie.com/embed/${ID}`
	])('%s', (url) => {
		expect(parseMediaUrl(url)).toEqual({
			provider: 'youtube',
			mediaId: ID,
			start: 0,
			title: 'YouTube video'
		});
	});

	it('reads start times', () => {
		expect(parseMediaUrl(`https://youtu.be/${ID}?t=90`)?.start).toBe(90);
		expect(parseMediaUrl(`https://www.youtube.com/watch?v=${ID}&t=1m30s`)?.start).toBe(90);
		expect(parseMediaUrl(`https://www.youtube.com/embed/${ID}?start=42`)?.start).toBe(42);
	});

	it('rejects bad ids and pages without a video', () => {
		expect(parseMediaUrl('https://www.youtube.com/watch?v=short')).toBeNull();
		expect(parseMediaUrl(`https://www.youtube.com/watch?v=${ID}"><script>`)).toBeNull();
		expect(parseMediaUrl('https://www.youtube.com/@channel')).toBeNull();
		expect(parseMediaUrl('https://www.youtube.com/')).toBeNull();
	});
});

describe('parseMediaUrl: Vimeo', () => {
	it('reads the id and #t=', () => {
		expect(parseMediaUrl('https://vimeo.com/76979871')).toMatchObject({
			provider: 'vimeo',
			mediaId: '76979871',
			start: 0
		});
		expect(parseMediaUrl('https://vimeo.com/channels/staffpicks/76979871#t=1m5s')).toMatchObject({
			mediaId: '76979871',
			start: 65
		});
		expect(parseMediaUrl('https://player.vimeo.com/video/76979871')?.mediaId).toBe('76979871');
		expect(parseMediaUrl('https://vimeo.com/about')).toBeNull();
	});
});

describe('parseMediaUrl: files', () => {
	it('recognizes video and audio by extension, titled with the file name', () => {
		expect(parseMediaUrl('https://cdn.example.com/clips/My%20talk.mp4')).toEqual({
			provider: 'video',
			mediaId: null,
			start: 0,
			title: 'My talk.mp4'
		});
		expect(parseMediaUrl('https://example.com/a.WEBM#t=12')).toMatchObject({
			provider: 'video',
			start: 12
		});
		expect(parseMediaUrl('https://example.com/song.mp3?x=1')).toMatchObject({
			provider: 'audio',
			title: 'song.mp3'
		});
		expect(parseMediaUrl('https://example.com/podcast.m4a')?.provider).toBe('audio');
		expect(parseMediaUrl('https://example.com/page.html')).toBeNull();
	});
});

describe('parseMediaUrl: safety', () => {
	it.each([
		`http://www.youtube.com/watch?v=${ID}`,
		'javascript:alert(1)',
		'data:video/mp4;base64,AAAA',
		'file:///home/me/video.mp4',
		`https://youtube.com.evil.example/watch?v=${ID}`,
		`https://evil.example/youtube.com/watch?v=${ID}`,
		`https://user:pass@youtube.com/watch?v=${ID}`,
		'not a url',
		''
	])('rejects %s', (url) => expect(parseMediaUrl(url)).toBeNull());
});

describe('helpers', () => {
	it('parseTime', () => {
		expect(parseTime('75')).toBe(75);
		expect(parseTime('1h2m3s')).toBe(3723);
		expect(parseTime('2m')).toBe(120);
		expect(parseTime('x')).toBe(0);
		expect(parseTime(null)).toBe(0);
	});

	it('embedUrl builds player URLs from the id only', () => {
		expect(embedUrl('youtube', ID, 0)).toBe(
			`https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&rel=0&playsinline=1`
		);
		expect(embedUrl('youtube', ID, 42.7)).toContain('start=42');
		expect(embedUrl('vimeo', '123', 65)).toBe(
			'https://player.vimeo.com/video/123?dnt=1&autoplay=1#t=65s'
		);
	});

	it('linkAt adds the time to a link', () => {
		expect(linkAt(`https://youtu.be/${ID}`, 'youtube', 30)).toBe(`https://youtu.be/${ID}?t=30`);
		expect(linkAt(`https://youtu.be/${ID}?t=5`, 'youtube', 0)).toBe(`https://youtu.be/${ID}`);
		expect(linkAt('https://vimeo.com/1', 'vimeo', 10)).toBe('https://vimeo.com/1#t=10');
	});
});
