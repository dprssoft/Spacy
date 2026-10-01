import type * as Y from 'yjs';
import { TemplateBuilder } from './builder';

const BLUE = { fill: '#a5d8ff', stroke: '#1971c2' };
const YELLOW = { fill: '#ffec99', stroke: '#f59f00' };

export function buildFlowchart(doc: Y.Doc): void {
	const b = new TemplateBuilder();
	const frame = b.frame('Flowchart', { x: 0, y: 0, w: 520, h: 760 });
	const col = (w: number) => 200 - w / 2 + 60; // centered on x = 260
	const parent = { parent: frame };
	const start = b.shape('terminator', { x: col(160), y: 40, w: 160, h: 60 }, 'Start', parent);
	const step1 = b.shape('process', { x: col(180), y: 160, w: 180, h: 80 }, 'Step 1', {
		...parent,
		style: BLUE
	});
	const ok = b.shape('decision', { x: col(180), y: 300, w: 180, h: 110 }, 'OK?', {
		...parent,
		style: YELLOW
	});
	const step2 = b.shape('process', { x: col(180), y: 470, w: 180, h: 80 }, 'Step 2', {
		...parent,
		style: BLUE
	});
	const end = b.shape('terminator', { x: col(160), y: 610, w: 160, h: 60 }, 'End', parent);
	b.connect(start, 's', step1, 'n');
	b.connect(step1, 's', ok, 'n');
	b.connect(ok, 's', step2, 'n', { label: 'Yes' });
	b.connect(step2, 's', end, 'n');
	b.connect(ok, 'e', step1, 'e', { label: 'No' });
	b.commit(doc);
}
