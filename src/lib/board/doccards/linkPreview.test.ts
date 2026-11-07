import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { describe, expect, it } from 'vitest';
import { canPreview, LinkPreview, previewAnchors } from './linkPreview';

const schema = getSchema([StarterKit, LinkPreview]);
const text = (t: string, href?: string, preview?: boolean) =>
	schema.text(t, href ? [schema.marks.link!.create({ href, preview: preview ?? null })] : []);
const doc = (...nodes: ReturnType<typeof text>[]) =>
	schema.nodes.doc!.create(null, schema.nodes.paragraph!.create(null, nodes));

describe('canPreview', () => {
	it('allows https pages of other sites only', () => {
		const own = 'https://me.github.io';
		expect(canPreview('https://example.com/a', own)).toBe(true);
		expect(canPreview('http://example.com', own)).toBe(false);
		expect(canPreview('mailto:a@b.c', own)).toBe(false);
		expect(canPreview('javascript:alert(1)', own)).toBe(false);
		expect(canPreview('https://me.github.io/Spacy', own)).toBe(false);
		expect(canPreview('not a url', own)).toBe(false);
		expect(canPreview(undefined, own)).toBe(false);
	});
});

describe('previewAnchors', () => {
	it('finds links with their preview on, at the end of each link', () => {
		const d = doc(
			text('see '),
			text('a', 'https://a.test/', true),
			text(' b '),
			text('c', 'https://c.test/')
		);
		expect(previewAnchors(d)).toEqual([{ pos: 6, url: 'https://a.test/' }]);
	});

	it('treats a link split by formatting as one', () => {
		const link = schema.marks.link!.create({ href: 'https://a.test/', preview: true });
		const bold = schema.marks.bold!.create();
		const d = doc(schema.text('ab', [link]), schema.text('cd', [bold, link]));
		expect(previewAnchors(d)).toEqual([{ pos: 5, url: 'https://a.test/' }]);
	});
});
