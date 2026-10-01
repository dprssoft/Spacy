import { describe, expect, it } from 'vitest';
import { getDocsMap } from '$lib/model/doc';
import { testCtx } from '../testCtx';
import { createDocCard } from '../tools/create';
import { getDocJSON } from './docJson';
import { createDocEditor } from './editorFactory';
import { cardMarkdown } from './exportMarkdown';

describe('getDocJSON / cardMarkdown', () => {
	it('reads the fragment without an editor, and sees a live editor’s edits immediately', async () => {
		const ctx = testCtx();
		const id = createDocCard(ctx, { x: 0, y: 0 });
		expect(getDocJSON(ctx, id)).toEqual({ type: 'doc', content: [] });
		const ed = createDocEditor({
			element: document.createElement('div'),
			fragment: getDocsMap(ctx.doc).get(id)!,
			editable: true
		});
		ed.commands.setContent(
			'<h2>Goals</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>ship</p></li></ul>'
		);
		expect(await cardMarkdown(ctx, id)).toBe('# Untitled\n\n## Goals\n\n- [x] ship\n');
		ed.commands.setContent('<p><strong>live</strong> text</p>');
		expect(await cardMarkdown(ctx, id)).toBe('# Untitled\n\n**live** text\n');
		ed.destroy();
		expect(getDocJSON(ctx, 'missing')).toEqual({ type: 'doc', content: [] });
	});
});
