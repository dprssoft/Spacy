import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { getDocsMap, getElementsMap, listElements } from '$lib/model/doc';
import { parseElement } from '$lib/model/schema';
import { TEMPLATE } from '$lib/model/origins';
import { docToMarkdown } from '$lib/board/doccards/markdown';
import { fragmentToJSON } from '$lib/board/doccards/fragmentJson';
import type { DocCardElement, Element, WidgetElement } from '$lib/model/types';
import { outlineChapters, outlineIds } from '$lib/board/writing/outline';
import { countTasks } from '$lib/board/widgets/progress/checklist';
import { widgetKind } from '$lib/board/widgets';
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
			if (el.type === 'widget') {
				const def = widgetKind(el.kind)!;
				expect(def, el.kind).toBeDefined();
				expect(def.parseConfig(el.config), el.kind).toEqual(el.config);
				expect(def.parseState(el.state)).toEqual(def.defaultState());
				const card = def.linkedCard?.(el.config);
				if (card) expect(byId.get(card)?.type).toBe('doccard');
			}
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

	it('is tidy: no overlapping stickies in a frame, no overlapping frames, a sensible size', async () => {
		const els = listElements((await built(id)).doc).filter((e) => e.type !== 'connector');
		const overlap = (a: Element, b: Element) =>
			a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
		const pairs = (list: Element[]) =>
			list.flatMap((a, i) => list.slice(i + 1).map((b) => [a, b] as const));
		const stickies = els.filter((e) => e.type === 'sticky' && e.parentId);
		for (const [a, b] of pairs(stickies))
			if (a.parentId === b.parentId) expect(overlap(a, b), `${a.id} / ${b.id}`).toBe(false);
		for (const [a, b] of pairs(els.filter((e) => e.type === 'frame')))
			expect(overlap(a, b), `${a.id} / ${b.id}`).toBe(false);
		const minX = Math.min(...els.map((e) => e.x));
		const minY = Math.min(...els.map((e) => e.y));
		expect(Math.max(...els.map((e) => e.x + e.w)) - minX).toBeLessThanOrEqual(4000);
		expect(Math.max(...els.map((e) => e.y + e.h)) - minY).toBeLessThanOrEqual(3000);
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

	it('kanban: three columns with 3 / 2 / 1 cards inside', async () => {
		const els = listElements((await built('kanban')).doc);
		const frames = els.filter((e) => e.type === 'frame');
		expect(frames.map((f) => (f as { title: string }).title)).toEqual([
			'To do',
			'In progress',
			'Done'
		]);
		const count = (f: Element) =>
			els.filter((e) => e.type === 'sticky' && e.parentId === f.id).length;
		expect(frames.map(count)).toEqual([3, 2, 1]);
	});

	it('business model canvas: the nine blocks', async () => {
		const frames = listElements((await built('business-model-canvas')).doc).filter(
			(e) => e.type === 'frame'
		);
		expect(frames).toHaveLength(9);
	});

	it('weekly planner: five days and a notes card with a checklist', async () => {
		const { doc } = await built('weekly-planner');
		const els = listElements(doc);
		expect(els.filter((e) => e.type === 'frame')).toHaveLength(5);
		const card = els.find((e) => e.type === 'doccard')!;
		expect(docToMarkdown(fragmentToJSON(getDocsMap(doc).get(card.id)!))).toContain(
			'- [ ] Top priority'
		);
	});

	it('save the cat: fifteen beats', async () => {
		const els = listElements((await built('save-the-cat')).doc);
		expect(els.filter((e) => e.type === 'sticky')).toHaveLength(15);
	});

	it('scene cards: three chapters of four scene cards with prompts', async () => {
		const { doc } = await built('scene-cards');
		const els = listElements(doc);
		const frames = els.filter((e) => e.type === 'frame');
		expect(frames).toHaveLength(3);
		for (const f of frames)
			expect(els.filter((e) => e.type === 'doccard' && e.parentId === f.id)).toHaveLength(4);
		const card = els.find((e) => e.type === 'doccard')!;
		expect(docToMarkdown(fragmentToJSON(getDocsMap(doc).get(card.id)!))).toContain('Goal:');
	});

	it("hero's journey: twelve stages in a connected circle", async () => {
		const els = listElements((await built('heros-journey')).doc);
		expect(els.filter((e) => e.type === 'sticky')).toHaveLength(12);
		expect(els.filter((e) => e.type === 'connector')).toHaveLength(12);
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

	it('OKRs: three objectives with three key results and a progress widget each', async () => {
		const els = listElements((await built('okrs')).doc);
		const frames = els.filter((e) => e.type === 'frame');
		expect(frames).toHaveLength(3);
		for (const f of frames)
			expect(
				els.filter((e) => e.type === 'widget' && e.kind === 'progress' && e.parentId === f.id)
			).toHaveLength(3);
	});

	it('1:1 meeting: the progress widget counts the card’s action items', async () => {
		const { doc } = await built('one-on-one');
		const els = listElements(doc);
		const card = els.find((e) => e.type === 'doccard')!;
		const progress = els.find((e) => e.type === 'widget' && e.kind === 'progress')!;
		expect(widgetKind('progress')!.linkedCard!((progress as WidgetElement).config)).toBe(card.id);
		const md = docToMarkdown(fragmentToJSON(getDocsMap(doc).get(card.id)!));
		expect(md).toContain('## Action items\n\n- [ ] Owner: task');
	});

	it('risk register and decision log: a status chip per row', async () => {
		for (const [id, rows] of [
			['risk-register', 4],
			['decision-log', 3]
		] as const) {
			const els = listElements((await built(id)).doc);
			expect(els.filter((e) => e.type === 'widget' && e.kind === 'status')).toHaveLength(rows);
		}
	});

	it('decision log: the doc card holds a table of date, decision, owner and why', async () => {
		const { doc } = await built('decision-log');
		const card = listElements(doc).find((e) => e.type === 'doccard')!;
		const md = docToMarkdown(fragmentToJSON(getDocsMap(doc).get(card.id)!));
		expect(md).toContain('| Date | Decision | Owner | Why |');
	});

	it('roadmap and sprint planning: deadlines in the future', async () => {
		const today = new Date().toISOString().slice(0, 10);
		for (const [id, count] of [
			['roadmap', 3],
			['sprint-planning', 1]
		] as const) {
			const els = listElements((await built(id)).doc);
			const deadlines = els.filter((e) => e.type === 'widget' && e.kind === 'deadline');
			expect(deadlines).toHaveLength(count);
			for (const d of deadlines)
				expect((d as { config: { date: string } }).config.date > today).toBe(true);
		}
	});

	it('lean canvas: the nine blocks', async () => {
		const frames = listElements((await built('lean-canvas')).doc).filter((e) => e.type === 'frame');
		expect(frames.map((f) => (f as { title: string }).title)).toContain('Unfair advantage');
		expect(frames).toHaveLength(9);
	});

	it('snowflake: ten step frames with a doc card each', async () => {
		const els = listElements((await built('snowflake')).doc);
		const frames = els.filter((e) => e.type === 'frame');
		expect(frames).toHaveLength(10);
		for (const f of frames)
			expect(els.filter((e) => e.type === 'doccard' && e.parentId === f.id)).toHaveLength(1);
	});

	it('chapter tracker: the outline lists chapters 1–6 in order, each with a status chip', async () => {
		const { doc } = await built('chapter-tracker');
		const els = listElements(doc);
		const cards = els.filter((e): e is DocCardElement => e.type === 'doccard');
		const ids = outlineIds(outlineChapters(cards, [], []));
		expect(ids.map((id) => cards.find((c) => c.id === id)!.title)).toEqual(
			[1, 2, 3, 4, 5, 6].map((n) => `Chapter ${n}`)
		);
		const chips = els.filter((e) => e.type === 'widget' && e.kind === 'status');
		expect(chips).toHaveLength(6);
		expect((chips[0] as WidgetElement).config).toMatchObject({
			options: [{ label: 'Draft' }, { label: 'Revising' }, { label: 'Done' }]
		});
	});

	it('plot grid: three plot rows of eight stickies', async () => {
		const els = listElements((await built('plot-grid')).doc);
		const frames = els.filter((e) => e.type === 'frame');
		expect(frames).toHaveLength(3);
		for (const f of frames)
			expect(els.filter((e) => e.type === 'sticky' && e.parentId === f.id)).toHaveLength(8);
	});

	it('revision checklist: three passes, counted by a linked progress widget', async () => {
		const { doc } = await built('revision-checklist');
		const els = listElements(doc);
		const card = els.find((e) => e.type === 'doccard')!;
		const progress = els.find((e) => e.type === 'widget' && e.kind === 'progress')!;
		expect(widgetKind('progress')!.linkedCard!((progress as WidgetElement).config)).toBe(card.id);
		const json = fragmentToJSON(getDocsMap(doc).get(card.id)!);
		expect(countTasks(json)).toEqual({ done: 0, total: 10 });
		const md = docToMarkdown(json);
		for (const pass of ['Structural edit', 'Line edit', 'Copy edit'])
			expect(md).toContain(`## ${pass}`);
	});

	it('series bible: four sections of cards, connected', async () => {
		const els = listElements((await built('series-bible')).doc);
		expect(
			els.filter((e) => e.type === 'frame').map((f) => (f as { title: string }).title)
		).toEqual(['Characters', 'Places', 'Timeline', 'Rules']);
		expect(els.filter((e) => e.type === 'doccard')).toHaveLength(8);
		const conns = els.filter((e) => e.type === 'connector');
		expect(conns).toHaveLength(3);
		const cardIds = new Set(els.filter((e) => e.type === 'doccard').map((e) => e.id));
		for (const c of conns)
			for (const end of [c.from, c.to])
				expect(end.kind !== 'free' && cardIds.has(end.elementId)).toBe(true);
	});

	it('facilitation: the widgets are set up for the session', async () => {
		const widgets = async (id: string) =>
			listElements((await built(id)).doc).filter((e): e is WidgetElement => e.type === 'widget');
		const ice = await widgets('icebreaker');
		expect(ice.map((w) => w.kind).sort()).toEqual(['timer', 'wheel']);
		expect(ice.find((w) => w.kind === 'timer')!.config).toMatchObject({ duration: 120 });
		const agenda = await widgets('workshop-agenda');
		expect(agenda.map((w) => (w.config as { duration: number }).duration)).toEqual(
			[5, 10, 20, 15, 10].map((m) => m * 60)
		);
		const standup = await widgets('standup');
		expect(standup.find((w) => w.kind === 'randomizer')!.config).toMatchObject({ mode: 'shuffle' });
		expect(standup.find((w) => w.kind === 'timer')!.config).toMatchObject({ duration: 900 });
	});
});
