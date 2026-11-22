import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import { DEFAULT_TIMER } from '$lib/board/widgets/timer/timer';
import { TemplateBuilder, type Tint } from './builder';

const FRAME = { w: 340, h: 500 };
const SECTIONS: [string, number, string, Tint, string][] = [
	['Welcome', 5, 'Goals for today and how we’ll work', 'gray', STICKY_COLORS.yellow],
	['Context', 10, 'What we know so far', 'blue', STICKY_COLORS.blue],
	['Ideas', 20, 'Everyone adds ideas, quietly first', 'yellow', STICKY_COLORS.yellow],
	['Discuss', 15, 'Group the ideas, pick the strongest', 'violet', STICKY_COLORS.violet],
	['Wrap-up', 10, 'Decisions, owners and next steps', 'green', STICKY_COLORS.green]
];

/** One frame per section, each with a countdown set to the section’s length. */
export function buildWorkshopAgenda(doc: Y.Doc): void {
	const b = new TemplateBuilder();
	const total = SECTIONS.reduce((sum, [, min]) => sum + min, 0);
	b.text({ x: 0, y: -90, w: 700, h: 34 }, 'Workshop agenda', {
		font: { size: 'l', bold: true, align: 'l' }
	});
	b.text({ x: 0, y: -50, w: 900, h: 26 }, `${total} minutes · Topic: …`, {
		font: { size: 'm', align: 'l' }
	});
	const frames = b.frameGrid(
		SECTIONS.map(([title, min]) => `${title} · ${min} min`),
		{ x: 0, y: 0 },
		FRAME,
		{ tints: SECTIONS.map(([, , , t]) => t) }
	);
	SECTIONS.forEach(([, min, prompt, , color], i) => {
		const f = frames[i]!;
		b.widget(
			'timer',
			{ x: f.x + 50, y: f.y + 24 },
			{ ...DEFAULT_TIMER, duration: min * 60 },
			{
				parent: f
			}
		);
		b.sticky({ x: f.x + 24, y: f.y + 288, w: FRAME.w - 48, h: 180 }, prompt, color, f);
	});
	b.commit(doc);
}
