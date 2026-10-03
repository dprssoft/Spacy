import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import { TemplateBuilder } from './builder';
import { commitWithDocs, doc, h, items } from './docHelpers';

const PARTS = ['Teaser', 'Act 1', 'Act 2', 'Act 3', 'Act 4'];
const STICKY = 200;
const GAP = 20;

export function buildScreenplay(ydoc: Y.Doc): void {
	const b = new TemplateBuilder();
	const frames = b.frameGrid(
		PARTS,
		{ x: 0, y: 0 },
		{ w: STICKY + GAP * 2, h: 3 * (STICKY + GAP) + GAP },
		{ gap: 30, tints: ['gray', 'blue', 'yellow', 'orange', 'green'] }
	);
	frames.forEach((f, i) => {
		const scenes = i === 0 ? 1 : 3;
		for (let k = 0; k < scenes; k++)
			b.sticky(
				{ x: f.x + GAP, y: f.y + GAP + k * (STICKY + GAP), w: STICKY, h: STICKY },
				k % 2 ? 'EXT. LOCATION — NIGHT\nWhat happens?' : 'INT. LOCATION — DAY\nWhat happens?',
				STICKY_COLORS.yellow,
				f
			);
	});
	const x = PARTS.length * (STICKY + GAP * 2 + 30) + 10;
	const cast = b.docCard({ x, y: 0, w: 360, h: 3 * (STICKY + GAP) + GAP }, 'Characters');
	commitWithDocs(
		b,
		ydoc,
		new Map([
			[
				cast.id,
				doc(
					h(2, 'Characters'),
					items('bulletList', [
						'NAME (age) — one line about them',
						'NAME (age) — one line about them'
					])
				)
			]
		])
	);
}
