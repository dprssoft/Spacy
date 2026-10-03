import type * as Y from 'yjs';
import { TemplateBuilder, type Tint } from './builder';

// The classic layout: five columns on top (the middle ones split in two), two blocks below.
const U = 280; // column width
const H = 640; // top area height
const LOW = 300; // bottom row height
const G = 16;
const BLOCKS: [string, number, number, number, number, Tint][] = [
	// title, x, y, w, h (in columns / rows), tint
	['Key partners', 0, 0, 1, 1, 'violet'],
	['Key activities', 1, 0, 1, 0.5, 'blue'],
	['Key resources', 1, 0.5, 1, 0.5, 'blue'],
	['Value propositions', 2, 0, 1, 1, 'red'],
	['Customer relationships', 3, 0, 1, 0.5, 'green'],
	['Channels', 3, 0.5, 1, 0.5, 'green'],
	['Customer segments', 4, 0, 1, 1, 'yellow'],
	['Cost structure', 0, 1, 2.5, 0, 'gray'],
	['Revenue streams', 2.5, 1, 2.5, 0, 'teal']
];

export function buildBusinessModelCanvas(doc: Y.Doc): void {
	const b = new TemplateBuilder();
	b.text({ x: 0, y: -90, w: 700, h: 34 }, 'Business model canvas', {
		font: { size: 'l', bold: true, align: 'l' }
	});
	for (const [title, cx, cy, cw, ch, tint] of BLOCKS) {
		const bottom = cy >= 1;
		const x = cx * (U + G);
		const y = bottom ? H + G * 2 : cy * (H + G);
		const w = cw * (U + G) - G;
		const h = bottom ? LOW : ch * (H + G) - G;
		b.frameGrid([title], { x, y }, { w, h }, { tints: [tint] });
	}
	b.commit(doc);
}
