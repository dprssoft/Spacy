import { describe, expect, it } from 'vitest';
import { getDocsMap } from '$lib/model/doc';
import { createElements } from '$lib/model/ops';
import { samples } from '$lib/model/testFixtures';
import { setDocContent } from '$lib/templates/docContent';
import { testCtx } from '../testCtx';
import { docStats } from './wordCount';

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });

describe('BoardWordStats', () => {
	it('counts canvas text and doc cards, and recounts a card after its text changes', async () => {
		const ctx = testCtx();
		createElements(ctx.doc, [
			{ ...samples.sticky('s'), text: 'two words' },
			samples.doccard('d'),
			samples.frame('f')
		]);
		setDocContent(getDocsMap(ctx.doc).get('d')!, { type: 'doc', content: [para('one two three')] });
		expect(ctx.words.words()).toBe(5);
		expect(ctx.words.words(['d'])).toBe(3);

		setDocContent(getDocsMap(ctx.doc).get('d')!, {
			type: 'doc',
			content: [para('one two three four')]
		});
		await new Promise((r) => setTimeout(r, 850));
		expect(ctx.words.words(['d'])).toBe(4);
	});
});

describe('counting cost', () => {
	// Timings vary with machine load: only a generous bound (catches quadratic behaviour); ~100 ms
	// when run alone on the development machine.
	it('a whole 20,000-word document counts in linear time', () => {
		const words = Array.from({ length: 20 }, (_, i) => `word${i}`).join(' ');
		const doc = { type: 'doc', content: Array.from({ length: 1000 }, () => para(words)) };
		const t0 = performance.now();
		const s = docStats(doc);
		const ms = performance.now() - t0;
		expect(s.words).toBe(20_000);
		expect(ms).toBeLessThan(2000);
	});
});

describe('editorDocStats', () => {
	it('recounts only changed blocks (cached by node identity)', async () => {
		const { getSchema } = await import('@tiptap/core');
		const { docExtensions } = await import('../doccards/editorFactory');
		const Y = await import('yjs');
		const { editorDocStats } = await import('./editorStats');
		const schema = getSchema(docExtensions(new Y.Doc().getXmlFragment('x')));
		const words = Array.from({ length: 20 }, (_, i) => `word${i}`).join(' ');
		const doc = schema.nodeFromJSON({
			type: 'doc',
			content: Array.from({ length: 1000 }, () => para(words))
		});
		const fresh = schema.nodeFromJSON(doc.toJSON());
		let t0 = performance.now();
		expect(editorDocStats(fresh).words).toBe(20_000);
		const full = performance.now() - t0;
		editorDocStats(doc);
		// Edit one paragraph: a new doc sharing the other 999 blocks.
		const edited = doc.replace(1, 2, doc.slice(1, 1));
		t0 = performance.now();
		const s = editorDocStats(edited);
		const incremental = performance.now() - t0;
		expect(s.paragraphs).toBe(1000);
		// Relative, so it holds under load: recounting one block is far cheaper than counting all.
		expect(incremental).toBeLessThan(full / 5);
	});
});
