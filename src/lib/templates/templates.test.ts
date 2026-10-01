import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { getDocsMap, getElementsMap, listElements } from '$lib/model/doc';
import { parseElement } from '$lib/model/schema';
import { TEMPLATE } from '$lib/model/origins';
import { docToMarkdown } from '$lib/board/doccards/markdown';
import { fragmentToJSON } from '$lib/board/doccards/fragmentJson';
import { templates } from './index';

async function built(id: string) {
	const doc = new Y.Doc();
	const origins = new Set<unknown>();
	doc.on('afterTransaction', (tr: Y.Transaction) => origins.add(tr.origin));
	await templates.find((t) => t.id === id)!.build(doc);
	return { doc, origins };
}

describe.each(templates.map((t) => t.id))('template %s', (id) => {
	it('builds valid, connected, framed content with the TEMPLATE origin', async () => {
		const { doc, origins } = await built(id);
		expect([...origins]).toEqual([TEMPLATE]);
		const raw = [...getElementsMap(doc).values()].map((m) => m.toJSON());
		expect(raw.length).toBeGreaterThan(3);
		for (const r of raw) expect(parseElement(r), JSON.stringify(r)).not.toBeNull();

		const els = listElements(doc);
		const byId = new Map(els.map((e) => [e.id, e]));
		for (const el of els) {
			if (el.type === 'connector')
				for (const end of [el.from, el.to])
					if (end.kind !== 'free') expect(byId.has(end.elementId)).toBe(true);
			if (el.parentId) {
				const f = byId.get(el.parentId)!;
				expect(f.type).toBe('frame');
				expect(el.x).toBeGreaterThanOrEqual(f.x);
				expect(el.y).toBeGreaterThanOrEqual(f.y);
				expect(el.x + el.w).toBeLessThanOrEqual(f.x + f.w);
				expect(el.y + el.h).toBeLessThanOrEqual(f.y + f.h);
			}
		}
	});
});

describe('template content', () => {
	it('flowchart: 5 shapes and 5 connectors with Yes/No labels', async () => {
		const els = listElements((await built('flowchart')).doc);
		expect(els.filter((e) => e.type === 'shape')).toHaveLength(5);
		const conns = els.filter((e) => e.type === 'connector');
		expect(conns).toHaveLength(5);
		expect(
			conns
				.map((c) => c.label.text)
				.filter(Boolean)
				.sort()
		).toEqual(['No', 'Yes']);
	});

	it('brainstorm: six stickies in six colors around the topic', async () => {
		const els = listElements((await built('brainstorm')).doc);
		const stickies = els.filter((e) => e.type === 'sticky');
		expect(new Set(stickies.map((s) => s.color)).size).toBe(6);
		expect(els.filter((e) => e.type === 'connector')).toHaveLength(6);
	});

	it('meeting notes: the doc card has the agenda and action items', async () => {
		const { doc } = await built('meeting-notes');
		const card = listElements(doc).find((e) => e.type === 'doccard')!;
		const frag = getDocsMap(doc).get(card.id)!;
		expect(frag.toString()).toContain('Action items');
		const md = docToMarkdown(fragmentToJSON(frag));
		expect(md).toContain('## Action items\n\n- [ ] Owner: task');
		expect(md).toContain('1. Topic one');
	});
});
