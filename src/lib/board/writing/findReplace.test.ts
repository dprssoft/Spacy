import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { getActivePageId, getDocsMap } from '$lib/model/doc';
import { createElements, updateElement } from '$lib/model/ops';
import { samples } from '$lib/model/testFixtures';
import { fragmentToJSON } from '../doccards/fragmentJson';
import { testCtx } from '../testCtx';
import { allPageIds, replaceHits, searchBoard } from './findReplace';
import { makeMatcher, type Matcher } from './search';

const matcher = (q: string) =>
	makeMatcher(q, { matchCase: true, wholeWord: true, regex: false }) as Matcher;

function setup() {
	const ctx = testCtx();
	createElements(ctx.doc, [
		{ ...samples.sticky('s'), text: 'Mara waits' },
		{ ...samples.frame('f'), title: "Mara's house" },
		{ ...samples.doccard('d'), title: 'Scene' }
	]);
	// Doc text: "Then <b>Mara</b> came, @Mara." with a mention chip.
	const frag = getDocsMap(ctx.doc).get('d')!;
	ctx.doc.transact(() => {
		const p = new Y.XmlElement('paragraph');
		frag.insert(0, [p]);
		const t = new Y.XmlText();
		const mention = new Y.XmlElement('mention');
		mention.setAttribute('id', 's');
		mention.setAttribute('label', 'Mara');
		const tail = new Y.XmlText(' later, Mara.');
		p.insert(0, [t, mention, tail]);
		t.insert(0, 'Then ');
		t.insert(5, 'Mara', { bold: {} });
		t.insert(9, ' came, ', { bold: null }); // not inheriting the bold before it
	});
	return ctx;
}

describe('find and replace', () => {
	it('finds in canvas fields and doc text (not inside mention chips)', () => {
		const ctx = setup();
		const hits = searchBoard(ctx.doc, matcher('Mara'), [getActivePageId(ctx.doc)]);
		expect(hits.map((h) => `${h.kind}:${h.elementId}`).sort()).toEqual([
			'doc:d',
			'doc:d',
			'element:f',
			'element:s'
		]);
	});

	it('replace all: one undo step, formatting and mentions kept', () => {
		const ctx = setup();
		const m = matcher('Mara');
		const hits = searchBoard(ctx.doc, m, allPageIds(ctx.doc));
		ctx.undo.stopCapturing();
		expect(replaceHits(ctx.doc, hits, m, 'Lena')).toBe(4);
		expect((ctx.store.get('s') as { text: string }).text).toBe('Lena waits');
		expect((ctx.store.get('f') as { title: string }).title).toBe("Lena's house");
		const json = JSON.stringify(fragmentToJSON(getDocsMap(ctx.doc).get('d')!));
		expect(json).toContain('{"type":"text","text":"Lena","marks":[{"type":"bold"}]}');
		expect(json).toContain('"label":"Mara"'); // the chip shows the object's name, untouched
		expect(json).toContain(' later, Lena.');

		ctx.undo.undo();
		expect((ctx.store.get('s') as { text: string }).text).toBe('Mara waits');
		expect(JSON.stringify(fragmentToJSON(getDocsMap(ctx.doc).get('d')!))).toContain('later, Mara.');
	});

	it('skips hits whose text changed since the search', () => {
		const ctx = setup();
		const m = matcher('Mara');
		const hits = searchBoard(ctx.doc, m, [getActivePageId(ctx.doc)]).filter(
			(h) => h.elementId === 's'
		);
		updateElement(ctx.doc, 's', { text: 'Someone else' });
		expect(replaceHits(ctx.doc, hits, m, 'Lena')).toBe(0);
	});
});
