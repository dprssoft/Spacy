import type * as Y from 'yjs';
import { TemplateBuilder } from './builder';

const BRANCHES: [string, string, string, number][] = [
	// label, fill, stroke, angle (radians)
	['Branch 1', '#a5d8ff', '#1c7ed6', -Math.PI / 4],
	['Branch 2', '#b2f2bb', '#2f9e44', Math.PI / 4],
	['Branch 3', '#ffd8a8', '#e8590c', (3 * Math.PI) / 4],
	['Branch 4', '#eebefa', '#ae3ec9', (-3 * Math.PI) / 4]
];
const BRANCH = { w: 200, h: 80 };
const LEAF = { w: 160, h: 56 };

export function buildMindMap(doc: Y.Doc): void {
	const b = new TemplateBuilder();
	const c = { x: 0, y: 0 };
	const main = b.shape('ellipse', { x: c.x - 130, y: c.y - 70, w: 260, h: 140 }, 'Main idea', {
		style: { fill: '#d0bfff', stroke: '#6741d9', font: { size: 'l', bold: true } }
	});
	for (const [label, fill, stroke, a] of BRANCHES) {
		const bx = c.x + Math.cos(a) * 420;
		const by = c.y + Math.sin(a) * 260;
		const branch = b.shape(
			'rect',
			{ x: bx - BRANCH.w / 2, y: by - BRANCH.h / 2, ...BRANCH },
			label,
			{
				style: { fill, stroke, radius: 'lg', font: { bold: true } }
			}
		);
		b.connect(main, 'float', branch, 'float', { routing: 'curve', markerEnd: 'none' });
		const side = Math.cos(a) > 0 ? 1 : -1;
		for (let k = 0; k < 2; k++) {
			const lx = bx + side * 300;
			const ly = by + (k === 0 ? -50 : 50) + Math.sign(Math.sin(a)) * 30;
			const leaf = b.shape(
				'rect',
				{ x: lx - LEAF.w / 2, y: ly - LEAF.h / 2, ...LEAF },
				`Idea ${k + 1}`,
				{
					style: {
						fill: 'transparent',
						fillStyle: 'none',
						stroke,
						radius: 'lg',
						font: { size: 's' }
					}
				}
			);
			b.connect(branch, 'float', leaf, 'float', { routing: 'curve', markerEnd: 'none' });
		}
	}
	b.commit(doc);
}
