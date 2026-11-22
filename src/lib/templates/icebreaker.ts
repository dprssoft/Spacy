import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import { DEFAULT_TIMER } from '$lib/board/widgets/timer/timer';
import { DEFAULT_WHEEL, segmentsFrom } from '$lib/board/widgets/wheel/wheel';
import { TemplateBuilder } from './builder';

const QUESTIONS = [
	'What made you smile this week?',
	'Best thing you learned recently?',
	'A skill you’d love to have?',
	'Your go-to comfort food?'
];
const STICKY = 170;

export function buildIcebreaker(doc: Y.Doc): void {
	const b = new TemplateBuilder();
	b.text({ x: 0, y: -90, w: 700, h: 34 }, 'Icebreaker', {
		font: { size: 'l', bold: true, align: 'l' }
	});
	b.text({ x: 0, y: -50, w: 900, h: 26 }, 'Spin to pick who answers, then start the timer.', {
		font: { size: 'm', align: 'l' }
	});
	b.widget(
		'wheel',
		{ x: 0, y: 0 },
		{
			...DEFAULT_WHEEL,
			segments: segmentsFrom([
				'Team member 1',
				'Team member 2',
				'Team member 3',
				'Team member 4',
				'Team member 5',
				'Team member 6'
			])
		}
	);
	b.widget('timer', { x: 320, y: 0 }, { ...DEFAULT_TIMER, duration: 120 });
	const frame = b.frame('Questions', { x: 600, y: 0, w: 2 * STICKY + 72, h: 2 * STICKY + 72 });
	const colors = [
		STICKY_COLORS.yellow,
		STICKY_COLORS.pink,
		STICKY_COLORS.blue,
		STICKY_COLORS.green
	];
	QUESTIONS.forEach((q, i) =>
		b.sticky(
			{
				x: frame.x + 24 + (i % 2) * (STICKY + 24),
				y: frame.y + 24 + Math.floor(i / 2) * (STICKY + 24),
				w: STICKY,
				h: STICKY
			},
			q,
			colors[i]!,
			frame
		)
	);
	b.commit(doc);
}
