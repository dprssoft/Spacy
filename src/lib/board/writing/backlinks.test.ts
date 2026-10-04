import { describe, expect, it } from 'vitest';
import { getDocsMap } from '$lib/model/doc';
import { createElements, deleteElements } from '$lib/model/ops';
import { samples } from '$lib/model/testFixtures';
import * as Y from 'yjs';
import { testCtx } from '../testCtx';
import { mentionsIn } from './backlinks.svelte';

const mention = (id: string, label: string) => ({ type: 'mention', attrs: { id, label } });
const para = (...content: object[]) => ({ type: 'paragraph', content });
const text = (t: string) => ({ type: 'text', text: t });

describe('mentionsIn', () => {
	it('finds mentions with a snippet around each', () => {
		const long = 'x'.repeat(60);
		const found = mentionsIn({
			type: 'doc',
			content: [
				para(text(`${long} meets `), mention('m', 'Mara'), text(' at the gate.')),
				para(text('no mention'))
			]
		});
		expect(found).toEqual([
			{ target: 'm', snippet: `…${'x'.repeat(33)} meets @Mara at the gate.` }
		]);
	});
});

/** Writes paragraphs of text and mentions straight into a card's Yjs fragment (the base doc
 * schema used by setDocContent has no mention node; the board editor adds it). */
function write(frag: Y.XmlFragment, paras: (string | [string, string])[][]) {
	frag.doc!.transact(() => {
		frag.delete(0, frag.length);
		frag.insert(
			0,
			paras.map((parts) => {
				const p = new Y.XmlElement('paragraph');
				p.insert(
					0,
					parts.map((part) => {
						if (typeof part === 'string') return new Y.XmlText(part);
						const m = new Y.XmlElement('mention');
						m.setAttribute('id', part[0]);
						m.setAttribute('label', part[1]);
						return m;
					})
				);
				return p;
			})
		);
	});
}

describe('BacklinkIndex', () => {
	it('indexes mentions across cards, updates on edits and deletions', async () => {
		const ctx = testCtx();
		createElements(ctx.doc, [
			{ ...samples.sticky('mara'), text: 'Mara' },
			{ ...samples.doccard('s1'), title: 'Scene 1' },
			{ ...samples.doccard('s2'), title: 'Scene 2' }
		]);
		const docs = getDocsMap(ctx.doc);
		write(docs.get('s1')!, [['Hi ', ['mara', 'Mara'], ' and ', ['mara', 'Mara']]]);
		write(docs.get('s2')!, [[['mara', 'Mara']]]);
		expect(ctx.backlinks.of('mara').map((b) => b.cardTitle)).toEqual([
			'Scene 1',
			'Scene 1',
			'Scene 2'
		]);

		deleteElements(ctx.doc, ['s1']);
		await new Promise((r) => setTimeout(r, 350));
		expect(ctx.backlinks.of('mara').map((b) => b.cardTitle)).toEqual(['Scene 2']);
	});
});
