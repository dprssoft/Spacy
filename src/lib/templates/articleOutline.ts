import type * as Y from 'yjs';
import type { DocNode } from '$lib/board/doccards/markdown';
import { TemplateBuilder } from './builder';
import { commitWithDocs, doc, h, items, p } from './docHelpers';

const PARTS: [string, DocNode[]][] = [
	['Hook', [p('Open with a question, a scene or a surprising fact.')]],
	['Thesis', [p('One sentence: what this piece argues or shows.')]],
	['Section 1', [h(2, 'Section 1'), p('Main point, evidence, example.')]],
	['Section 2', [h(2, 'Section 2'), p('Main point, evidence, example.')]],
	['Section 3', [h(2, 'Section 3'), p('Main point, evidence, example.')]],
	['Counterpoints', [p('The strongest objection, and the answer to it.')]],
	['Conclusion', [p('What changes for the reader now?')]],
	['Sources', [items('bulletList', ['Author, Title (year). Link'])]]
];
const CARD = { w: 340, h: 280 };
const GAP = 30;

export function buildArticleOutline(ydoc: Y.Doc): void {
	const b = new TemplateBuilder();
	b.text({ x: 0, y: -80, w: 700, h: 34 }, 'Article outline', {
		font: { size: 'l', bold: true, align: 'l' }
	});
	const contents = new Map<string, DocNode>();
	PARTS.forEach(([title, body], i) => {
		const card = b.docCard(
			{ x: (i % 4) * (CARD.w + GAP), y: Math.floor(i / 4) * (CARD.h + GAP), ...CARD },
			title
		);
		contents.set(card.id, doc(...body));
	});
	commitWithDocs(b, ydoc, contents);
}
