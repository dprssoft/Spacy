import { describe, expect, it } from 'vitest';
import { MEDIA_AUDIO_SIZE } from '$lib/model/defaults';
import { listElements } from '$lib/model/doc';
import { createElements, deleteElements } from '$lib/model/ops';
import { parseElement } from '$lib/model/schema';
import { samples } from '$lib/model/testFixtures';
import { docToMarkdown } from '../doccards/markdown';
import { testCtx } from '../testCtx';
import { createMedia, mediaLinkIn } from './createMedia';
import { formatTime, posterSubtitle } from './poster';

describe('createMedia', () => {
	it('adds a selected media element at the point, as one undo step', () => {
		const ctx = testCtx();
		const id = createMedia(ctx, ' https://youtu.be/dQw4w9WgXcQ?t=30 ', { x: 0, y: 0 })!;
		const el = ctx.store.get(id)!;
		expect(el).toMatchObject({
			type: 'media',
			provider: 'youtube',
			mediaId: 'dQw4w9WgXcQ',
			start: 30,
			url: 'https://youtu.be/dQw4w9WgXcQ?t=30',
			x: -240,
			y: -135
		});
		expect([...ctx.selection.ids]).toEqual([id]);
		ctx.undo.undo();
		expect(listElements(ctx.doc)).toEqual([]);
	});

	it('sizes audio as a bar and ignores unsupported links', () => {
		const ctx = testCtx();
		const id = createMedia(ctx, 'https://example.com/a.mp3', { x: 0, y: 0 })!;
		expect(ctx.store.get(id)).toMatchObject({ provider: 'audio', ...MEDIA_AUDIO_SIZE });
		expect(createMedia(ctx, 'https://example.com/page', { x: 0, y: 0 })).toBeNull();
	});

	it('mediaLinkIn accepts one supported link and nothing else', () => {
		expect(mediaLinkIn('  https://vimeo.com/1 ')).toBe('https://vimeo.com/1');
		expect(mediaLinkIn('watch https://vimeo.com/1')).toBeNull();
		expect(mediaLinkIn('https://example.com')).toBeNull();
		expect(mediaLinkIn(null)).toBeNull();
	});
});

describe('media model', () => {
	it('validates https links and ids', () => {
		const ok = samples.media();
		expect(parseElement(ok)).not.toBeNull();
		expect(parseElement({ ...ok, url: 'http://x.example/a.mp4' })).toBeNull();
		expect(parseElement({ ...ok, url: 'javascript:alert(1)' })).toBeNull();
		expect(parseElement({ ...ok, mediaId: '../../evil' })).toBeNull();
		expect(parseElement({ ...ok, end: 12.5, loop: true })).not.toBeNull();
	});

	it('playback forgets deleted elements', () => {
		const ctx = testCtx();
		createElements(ctx.doc, [samples.media('m')]);
		ctx.playback.play('m');
		deleteElements(ctx.doc, ['m']);
		ctx.playback.prune((id) => ctx.store.elements.has(id));
		expect(ctx.playback.playing.size).toBe(0);
	});
});

describe('poster text', () => {
	it('formats times and subtitles', () => {
		expect(formatTime(75)).toBe('1:15');
		expect(formatTime(3725)).toBe('1:02:05');
		expect(posterSubtitle(samples.media())).toBe('YouTube');
		const file = {
			...samples.media(),
			provider: 'video' as const,
			url: 'https://cdn.example.com/a.mp4',
			mediaId: null
		};
		expect(posterSubtitle({ ...file, start: 30, end: 70 })).toBe(
			'Video · cdn.example.com · 0:30–1:10'
		);
		expect(posterSubtitle({ ...file, start: 30 })).toBe('Video · cdn.example.com · from 0:30');
	});
});

describe('Markdown export of media mentions', () => {
	it('links a mentioned media element', () => {
		const doc = {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [
						{ type: 'text', text: 'Watch ' },
						{ type: 'mention', attrs: { id: 'm', label: 'Launch talk' } },
						{ type: 'text', text: ' and ' },
						{ type: 'mention', attrs: { id: 's', label: 'Idea' } }
					]
				}
			]
		};
		const md = docToMarkdown(doc, {
			link: (id) => (id === 'm' ? 'https://youtu.be/dQw4w9WgXcQ' : null)
		});
		expect(md).toBe('Watch [Launch talk](https://youtu.be/dQw4w9WgXcQ) and @Idea\n');
	});
});
