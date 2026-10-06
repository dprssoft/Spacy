import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { yXmlFragmentToProseMirrorRootNode } from '@tiptap/y-tiptap';
import { getDocsMap, listElements } from '$lib/model/doc';
import { docSchema, setDocContent } from '$lib/templates/docContent';
import { templates } from '$lib/templates';
import { fragmentToJSON } from './fragmentJson';
import { writeDocJSON } from './fragmentWrite';

// Templates write their doc cards with `writeDocJSON`; build them a second time through TipTap's
// own writer to check the editor sees exactly the same documents.
const mode = vi.hoisted(() => ({ tiptap: false }));
vi.mock('./fragmentWrite', async (original) => {
	const real = await original<typeof import('./fragmentWrite')>();
	const { setDocContent } = await import('$lib/templates/docContent');
	return {
		writeDocJSON: (f: Y.XmlFragment, j: Parameters<typeof real.writeDocJSON>[1]) =>
			mode.tiptap ? setDocContent(f, j) : real.writeDocJSON(f, j)
	};
});

/** What the editor shows for each doc card of a freshly built template, in creation order. */
async function editorDocs(id: string, tiptap: boolean): Promise<unknown[]> {
	mode.tiptap = tiptap;
	const doc = new Y.Doc();
	await templates.find((t) => t.id === id)!.build(doc);
	const docs = getDocsMap(doc);
	return listElements(doc)
		.filter((el) => el.type === 'doccard')
		.map((el) => yXmlFragmentToProseMirrorRootNode(docs.get(el.id)!, docSchema()).toJSON());
}

describe('writeDocJSON', () => {
	beforeEach(() => {
		mode.tiptap = false;
	});

	it.each(templates.map((t) => t.id))(
		'template "%s": the editor sees the same docs',
		async (id) => {
			const ours = await editorDocs(id, false);
			expect(ours).toEqual(await editorDocs(id, true));
		}
	);

	it('round-trips with fragmentToJSON: marks with and without attributes, nesting, attrs', () => {
		const json = {
			type: 'doc',
			content: [
				{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
				{
					type: 'paragraph',
					content: [
						{ type: 'text', text: 'plain ' },
						{ type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
						{
							type: 'text',
							text: ' link',
							marks: [{ type: 'link', attrs: { href: 'https://example.com' } }]
						}
					]
				},
				{
					type: 'bulletList',
					content: [
						{
							type: 'listItem',
							content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }]
						}
					]
				},
				{ type: 'paragraph' }
			]
		};
		const frag = new Y.Doc().getXmlFragment('t');
		writeDocJSON(frag, json);
		expect(fragmentToJSON(frag)).toEqual(json);
		// Writing again replaces the content.
		writeDocJSON(frag, { type: 'doc', content: [{ type: 'paragraph' }] });
		expect(fragmentToJSON(frag)).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
	});

	it('the editor reads it like TipTap’s own writer', () => {
		const json = {
			type: 'doc',
			content: [
				{
					type: 'taskList',
					content: [
						{
							type: 'taskItem',
							attrs: { checked: true },
							content: [{ type: 'paragraph', content: [{ type: 'text', text: 'done' }] }]
						}
					]
				}
			]
		};
		const a = new Y.Doc().getXmlFragment('a');
		const b = new Y.Doc().getXmlFragment('b');
		writeDocJSON(a, json);
		setDocContent(b, json);
		const read = (f: Y.XmlFragment) => yXmlFragmentToProseMirrorRootNode(f, docSchema()).toJSON();
		expect(read(a)).toEqual(read(b));
	});
});
