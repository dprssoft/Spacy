import type * as Y from 'yjs';
import type { DocNode } from '$lib/board/doccards/markdown';
import { TemplateBuilder } from './builder';
import { commitWithDocs, doc, h, items, p } from './docHelpers';
import { statusChip } from './widgetConfigs';

const CHAPTERS = 6;
const CARD = { w: 280, h: 320 };
const GAP = 40;
const STATUS: [string, string][] = [
	['Draft', '#868e96'],
	['Revising', '#f08c00'],
	['Done', '#2f9e44']
];

const chapter = (n: number): DocNode =>
	doc(h(2, `Chapter ${n}`), p('What happens: '), items('bulletList', ['Scene', 'Scene']));

/** Chapter cards left to right (the outline's reading order), each with a status chip. */
export function buildChapterTracker(ydoc: Y.Doc): void {
	const b = new TemplateBuilder();
	b.text({ x: 0, y: -90, w: 700, h: 34 }, 'Chapter tracker', {
		font: { size: 'l', bold: true, align: 'l' }
	});
	const contents = new Map<string, DocNode>();
	for (let i = 0; i < CHAPTERS; i++) {
		const x = i * (CARD.w + GAP);
		const card = b.docCard({ x, y: 0, ...CARD }, `Chapter ${i + 1}`);
		contents.set(card.id, chapter(i + 1));
		b.widget('status', { x, y: CARD.h + 20 }, statusChip(STATUS));
	}
	commitWithDocs(b, ydoc, contents);
}
