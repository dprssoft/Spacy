import type * as Y from 'yjs';
import { STICKY_COLORS } from '$lib/model/defaults';
import { DEFAULT_RANDOMIZER } from '$lib/board/widgets/randomizer/randomizer';
import { DEFAULT_TIMER } from '$lib/board/widgets/timer/timer';
import { TemplateBuilder } from './builder';

const STICKY = 170;

export function buildStandup(doc: Y.Doc): void {
	const b = new TemplateBuilder();
	b.text({ x: 0, y: -90, w: 700, h: 34 }, 'Daily stand-up', {
		font: { size: 'l', bold: true, align: 'l' }
	});
	b.text(
		{ x: 0, y: -50, w: 900, h: 26 },
		'Shuffle the speaking order, start the timer. Yesterday, today, blockers.',
		{ font: { size: 'm', align: 'l' } }
	);
	b.widget(
		'randomizer',
		{ x: 0, y: 0 },
		{ ...DEFAULT_RANDOMIZER, mode: 'shuffle' },
		{
			title: 'Speaking order'
		}
	);
	b.widget('timer', { x: 300, y: 0 }, { ...DEFAULT_TIMER, duration: 15 * 60 });
	const frame = b.frame('Blockers', { x: 580, y: 0, w: 2 * STICKY + 72, h: STICKY + 48 });
	['Blocker', 'Who can help?'].forEach((text, i) =>
		b.sticky(
			{ x: frame.x + 24 + i * (STICKY + 24), y: frame.y + 24, w: STICKY, h: STICKY },
			text,
			STICKY_COLORS.pink,
			frame
		)
	);
	b.commit(doc);
}
