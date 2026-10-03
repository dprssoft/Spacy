import type * as Y from 'yjs';
import type { DocNode } from '$lib/board/doccards/markdown';
import { TemplateBuilder } from './builder';
import { commitWithDocs, doc, h, p } from './docHelpers';

const CARD = { w: 300, h: 300 };
const GAP = 24;

const scene = (n: number): DocNode =>
	doc(h(2, `Scene ${n}`), p('POV: '), p('Goal: '), p('Conflict: '), p('Outcome: '));

/** Three chapters of four scene cards each: ready for the outline and compile. */
export function buildSceneCards(ydoc: Y.Doc): void {
	const b = new TemplateBuilder();
	const w = 4 * (CARD.w + GAP) + GAP;
	const frames = b.frameGrid(
		['Chapter 1', 'Chapter 2', 'Chapter 3'],
		{ x: 0, y: 0 },
		{ w, h: CARD.h + GAP * 2 },
		{ cols: 1, gap: 60, tints: ['blue', 'yellow', 'green'] }
	);
	const contents = new Map<string, DocNode>();
	let n = 0;
	for (const f of frames)
		for (let i = 0; i < 4; i++) {
			n++;
			const card = b.docCard(
				{ x: f.x + GAP + i * (CARD.w + GAP), y: f.y + GAP, ...CARD },
				`Scene ${n}`,
				f
			);
			contents.set(card.id, scene(n));
		}
	commitWithDocs(b, ydoc, contents);
}
