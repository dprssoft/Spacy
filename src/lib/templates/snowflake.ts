import type * as Y from 'yjs';
import type { DocNode } from '$lib/board/doccards/markdown';
import { TemplateBuilder, type Tint } from './builder';
import { commitWithDocs, doc, h, p } from './docHelpers';

// Randy Ingermanson's snowflake method: each step grows the one before it.
const STEPS: [string, string][] = [
	['One-sentence summary', 'The whole story in one sentence of about 15 words.'],
	['One-paragraph summary', 'Setup, three disasters and the ending, in five sentences.'],
	['Character summaries', 'For each main character: goal, motivation, conflict, epiphany.'],
	['One-page synopsis', 'Grow each sentence of the paragraph into a paragraph.'],
	['Character synopses', 'Each main character’s story, told from their point of view.'],
	['Four-page synopsis', 'Grow each paragraph of the synopsis into a page.'],
	['Character charts', 'Everything about each character: history, wants, how they change.'],
	['Scene list', 'One line per scene: who, what happens, how long.'],
	['Scene descriptions', 'A paragraph per scene: the conflict, and how it turns.'],
	['First draft', 'Write it, scene by scene.']
];
const TINTS: Tint[] = ['blue', 'teal', 'green', 'yellow', 'orange'];
const FRAME = { w: 360, h: 400 };
const PAD = 24;

export function buildSnowflake(ydoc: Y.Doc): void {
	const b = new TemplateBuilder();
	b.text({ x: 0, y: -90, w: 700, h: 34 }, 'Snowflake method', {
		font: { size: 'l', bold: true, align: 'l' }
	});
	const frames = b.frameGrid(
		STEPS.map(([title], i) => `${i + 1}. ${title}`),
		{ x: 0, y: 0 },
		FRAME,
		{ cols: 5, tints: TINTS }
	);
	const contents = new Map<string, DocNode>();
	STEPS.forEach(([title, prompt], i) => {
		const f = frames[i]!;
		const card = b.docCard(
			{ x: f.x + PAD, y: f.y + PAD, w: FRAME.w - 2 * PAD, h: FRAME.h - 2 * PAD },
			title,
			f
		);
		contents.set(card.id, doc(h(2, title), p(prompt), p('')));
	});
	commitWithDocs(b, ydoc, contents);
}
