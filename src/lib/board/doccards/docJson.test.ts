import { describe, expect, it } from 'vitest';
import { getDocsMap } from '$lib/model/doc';
import { testCtx } from '../testCtx';
import { createDocCard } from '../tools/create';
import { getDocJSON } from './docJson';
import { createDocEditor } from './editorFactory';
import { registerEditor } from './editorRegistry';
import { cardMarkdown } from './exportMarkdown';

function fill(ctx: ReturnType<typeof testCtx>, id: string, html: string) {
	const ed = createDocEditor({
		element: document.createElement('div'),
		fragment: getDocsMap(ctx.doc).get(id)!,
		editable: true
	});
	ed.commands.setContent(html);
	return ed;
}

describe('getDocJSON / cardMarkdown', () => {
	it('reads the fragment with a headless editor when none is mounted', async () => {
		const ctx = testCtx();
		const id = createDocCard(ctx, { x: 0, y: 0 });
		fill(
			ctx,
			id,
			'<h2>Goals</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>ship</p></li></ul>'
		).destroy();
		const json = await getDocJSON(ctx, id);
		expect(JSON.stringify(json)).toContain('"taskItem"');
		expect(await cardMarkdown(ctx, id)).toBe('# Untitled\n\n## Goals\n\n- [x] ship\n');
	});

	it('uses a live editor when one is registered', async () => {
		const ctx = testCtx();
		const id = createDocCard(ctx, { x: 0, y: 0 });
		const ed = fill(ctx, id, '<p><strong>live</strong> text</p>');
		const off = registerEditor(id, ed);
		expect(await cardMarkdown(ctx, id)).toBe('# Untitled\n\n**live** text\n');
		off();
		ed.destroy();
	});
});
