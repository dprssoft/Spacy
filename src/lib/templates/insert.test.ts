import { describe, expect, it, vi } from 'vitest';
import { getDocsMap, listElements } from '$lib/model/doc';
import { createElements } from '$lib/model/ops';
import { samples } from '$lib/model/testFixtures';
import type { Element } from '$lib/model/types';
import { fragmentToJSON } from '$lib/board/doccards/fragmentJson';
import { docToMarkdown } from '$lib/board/doccards/markdown';
import { endpointElementId } from '$lib/board/diagram/endpoints';
import '$lib/board/elements';
import { testCtx } from '$lib/board/testCtx';
import { searchTemplates, templates } from './index';
import { insertTemplate } from './insert';

const byId = (id: string) => templates.find((t) => t.id === id)!;

describe.each(templates.map((t) => t.id))('insertTemplate(%s)', (id) => {
	it('adds new, self-consistent elements as one undo step and selects them', async () => {
		const ctx = testCtx();
		createElements(ctx.doc, [samples.shape('existing')]);
		const ids = await insertTemplate(ctx, byId(id));
		const els = listElements(ctx.doc);
		const added = els.filter((e) => ids.includes(e.id));

		expect(ids.length).toBeGreaterThan(3);
		expect(new Set(els.map((e) => e.id)).size).toBe(els.length);
		expect([...ctx.selection.ids].sort()).toEqual([...ids].sort());
		const has = new Set(ids);
		for (const el of added) {
			if (el.parentId) expect(has.has(el.parentId)).toBe(true);
			if (el.type === 'connector')
				for (const end of [el.from, el.to]) {
					const target = endpointElementId(end);
					if (target) expect(has.has(target)).toBe(true);
				}
		}

		ctx.undo.undo();
		expect(listElements(ctx.doc).map((e: Element) => e.id)).toEqual(['existing']);
	});
});

describe('insertTemplate', () => {
	it('centers the template in the view and copies doc card contents', async () => {
		const ctx = testCtx(); // the view is centered on the world origin
		const ids = await insertTemplate(ctx, byId('meeting-notes'));
		const added = listElements(ctx.doc).filter((e) => ids.includes(e.id) && e.type !== 'connector');
		const minX = Math.min(...added.map((e) => e.x));
		const maxX = Math.max(...added.map((e) => e.x + e.w));
		expect(Math.abs((minX + maxX) / 2)).toBeLessThan(40);

		const card = added.find((e) => e.type === 'doccard')!;
		const md = docToMarkdown(fragmentToJSON(getDocsMap(ctx.doc).get(card.id)!));
		expect(md).toContain('Action items');
	});

	it('inserting twice gives two independent copies', async () => {
		const ctx = testCtx();
		const a = await insertTemplate(ctx, byId('flowchart'));
		const b = await insertTemplate(ctx, byId('flowchart'));
		expect(a.some((id) => b.includes(id))).toBe(false);
		expect(listElements(ctx.doc)).toHaveLength(a.length + b.length);
	});

	it('fits the view to the template only when it is bigger than the view', async () => {
		const ctx = testCtx();
		const fit = vi.spyOn(ctx.viewport, 'fit').mockImplementation(() => {});
		await insertTemplate(ctx, byId('flowchart'));
		ctx.viewport.size = { w: 300, h: 200 };
		ctx.viewport.set({ x: 150, y: 100, zoom: 1 });
		const ids = await insertTemplate(ctx, byId('brainstorm'));
		expect(fit).toHaveBeenCalledTimes(1);
		const rect = fit.mock.calls[0]![0]!;
		for (const id of ids) {
			const el = ctx.store.get(id)!;
			if (el.type === 'connector') continue;
			expect(el.x).toBeGreaterThanOrEqual(rect.x - 1);
			expect(el.x + el.w).toBeLessThanOrEqual(rect.x + rect.w + 1);
		}
	});
});

describe('searchTemplates', () => {
	it('matches every word against name, description, category and keywords', () => {
		expect(searchTemplates('flow').map((t) => t.id)).toEqual(['flowchart']);
		expect(searchTemplates('agenda minutes').map((t) => t.id)).toEqual(['meeting-notes']);
		expect(searchTemplates('', 'Workshops').map((t) => t.id)).toEqual(['brainstorm']);
		expect(searchTemplates('nothing-like-this')).toEqual([]);
	});
});
