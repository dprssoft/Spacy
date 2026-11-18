import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import type { DocNode } from '$lib/board/doccards/markdown';
import { TemplateBuilder } from './builder';
import { commitWithDocs, doc as docNode, h, p } from './docHelpers';
import { statusChip } from './widgetConfigs';

const row = (cell: 'tableHeader' | 'tableCell', texts: string[]): DocNode => ({
	type: 'tableRow',
	content: texts.map((x) => ({ type: cell, content: [p(x)] }))
});

export const DECISION_LOG: DocNode = docNode(
	h(1, 'Decision log'),
	p('Decisions we made, and why, so we don’t revisit them by accident.'),
	{
		type: 'table',
		content: [
			row('tableHeader', ['Date', 'Decision', 'Owner', 'Why']),
			row('tableCell', ['…', 'What we decided', 'Name', 'The reason, the options we dropped']),
			row('tableCell', ['…', '', '', '']),
			row('tableCell', ['…', '', '', ''])
		]
	}
);

const STATUS: [string, string][] = [
	['Proposed', '#1971c2'],
	['Discussing', '#f08c00'],
	['Decided', '#2f9e44'],
	['Dropped', '#868e96']
];
const ROW = 124;

export function buildDecisionLog(doc: Y.Doc): void {
	const b = new TemplateBuilder();
	const card = b.docCard({ x: 0, y: 0, w: 640, h: 440 }, 'Decision log');
	const open = b.frame('Open decisions', { x: 720, y: 0, w: 520, h: 24 + 3 * ROW });
	for (let i = 0; i < 3; i++) {
		const y = 24 + i * ROW;
		b.sticky({ x: 744, y, w: 300, h: 100 }, 'Question to decide', STICKY_COLORS.violet, open);
		b.widget('status', { x: 1080, y: y + 34 }, statusChip(STATUS), { parent: open });
	}
	commitWithDocs(b, doc, new Map([[card.id, DECISION_LOG]]));
}
