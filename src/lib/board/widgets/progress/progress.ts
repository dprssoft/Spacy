import { cloneHooks } from '$lib/model/clone';
import { z } from '$lib/shared/zod';
import { NO_ENV, registerWidgetKind, type WidgetEnv, type WidgetKind } from '../kinds';
import { escapeXml, fitText, n, text } from '../svg';

// A progress bar or ring, set by hand or counted from a linked doc card's checklist. It's part of
// the board's content, so everything it has is config (LOCAL, undoable); it has no state.

export const PROGRESS_COLORS = ['#1971c2', '#2f9e44', '#0c8599', '#7048e8', '#e8590c', '#e03131'];
const configSchema = z.object({
	source: z.enum(['manual', 'checklist']),
	value: z.number().min(0).max(100),
	cardId: z.string().nullable(),
	look: z.enum(['bar', 'ring']),
	color: z.string().regex(/^#[0-9a-f]{6}$/i)
});

export type ProgressConfig = z.infer<typeof configSchema>;

export const DEFAULT_PROGRESS: ProgressConfig = {
	source: 'manual',
	value: 0,
	cardId: null,
	look: 'bar',
	color: PROGRESS_COLORS[0]!
};
const MUTED = '#868e96';
const TRACK = '#e9ecef';

// Design space 260 × 110. The bar (and its drag zone) runs from x 16 to 244.
const BAR = { x: 16, y: 52, w: 228, h: 14 };
const ZONE = { x: BAR.x - 6, y: 40, w: BAR.w + 12, h: 40 };

export interface ProgressReading {
	/** 0..100, or null when a checklist source has nothing to count. */
	percent: number | null;
	caption: string;
}

export function readProgress(c: ProgressConfig, env: WidgetEnv): ProgressReading {
	if (c.source === 'manual') return { percent: Math.round(c.value), caption: '' };
	const tasks = c.cardId ? env.tasks(c.cardId) : null;
	if (!tasks) return { percent: null, caption: c.cardId ? 'No checklist' : 'No doc card linked' };
	return {
		percent: Math.round((tasks.done / tasks.total) * 100),
		caption: `${tasks.done} of ${tasks.total} task${tasks.total === 1 ? '' : 's'} done`
	};
}

/** The value a drag at design x sets: 5 % steps, or 1 % with `fine`. */
export function valueAt(x: number, fine: boolean): number {
	const raw = ((x - BAR.x) / BAR.w) * 100;
	const step = fine ? 1 : 5;
	return Math.min(100, Math.max(0, Math.round(raw / step) * step));
}

const label = (p: number | null) => (p === null ? '—' : `${p}%`);

function bar(c: ProgressConfig, r: ProgressReading, ink: string, title: string): string {
	const f = (r.percent ?? 0) / 100;
	return (
		text(BAR.x, 32, fitText(title || 'Progress', 14, 150), 14, ink, 'font-weight="600"') +
		text(
			244,
			34,
			label(r.percent),
			22,
			r.percent === null ? MUTED : ink,
			'text-anchor="end" font-weight="700" style="font-variant-numeric:tabular-nums"'
		) +
		`<rect x="${BAR.x}" y="${BAR.y}" width="${BAR.w}" height="${BAR.h}" rx="${BAR.h / 2}" fill="${TRACK}"/>` +
		(f > 0
			? `<rect x="${BAR.x}" y="${BAR.y}" width="${n(Math.max(BAR.h, BAR.w * f))}" height="${BAR.h}" rx="${BAR.h / 2}" fill="${escapeXml(c.color)}"/>`
			: '') +
		(r.caption ? text(BAR.x, 92, fitText(r.caption, 12, BAR.w), 12, MUTED) : '')
	);
}

function ring(c: ProgressConfig, r: ProgressReading, ink: string, title: string): string {
	const cx = 58;
	const cy = 55;
	const rad = 36;
	const len = 2 * Math.PI * rad;
	const f = (r.percent ?? 0) / 100;
	return (
		`<circle cx="${cx}" cy="${cy}" r="${rad}" fill="none" stroke="${TRACK}" stroke-width="10"/>` +
		(f > 0
			? `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="none" stroke="${escapeXml(c.color)}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${n(len * f)} ${n(len)}" transform="rotate(-90 ${cx} ${cy})"/>`
			: '') +
		text(
			cx,
			cy + 6,
			label(r.percent),
			17,
			r.percent === null ? MUTED : ink,
			'text-anchor="middle" font-weight="700" style="font-variant-numeric:tabular-nums"'
		) +
		text(
			112,
			r.caption ? 50 : 60,
			fitText(title || 'Progress', 14, 136),
			14,
			ink,
			'font-weight="600"'
		) +
		(r.caption ? text(112, 70, fitText(r.caption, 12, 136), 12, MUTED) : '')
	);
}

export const progressKind: WidgetKind<ProgressConfig, null> = {
	kind: 'progress',
	label: 'Progress',
	group: 'Team',
	design: { w: 260, h: 110 },
	parseConfig: (raw) => configSchema.catch(DEFAULT_PROGRESS).parse(raw),
	parseState: () => null,
	defaultConfig: () => ({ ...DEFAULT_PROGRESS }),
	defaultState: () => null,
	face(c, _s, _now, title, env = NO_ENV) {
		const r = readProgress(c, env);
		return {
			headline: label(r.percent),
			caption: r.caption || title || 'Progress',
			ring: r.percent === null ? null : r.percent / 100,
			accent: c.color
		};
	},
	art: (c, _s, _now, { ink, title }, env = NO_ENV) =>
		(c.look === 'ring' ? ring : bar)(c, readProgress(c, env), ink, title),
	actions: (c) =>
		c.source === 'manual' && c.look === 'bar'
			? [
					{
						id: 'set',
						label: 'Set progress',
						glyph: { text: '' },
						rect: ZONE,
						drag: true,
						bare: true
					}
				]
			: [],
	dragTo(action, c, p, fine) {
		if (action !== 'set' || c.source !== 'manual') return null;
		const value = valueAt(p.x, fine);
		return value === c.value ? null : { ...c, value };
	},
	perform: () => null,
	linkedCard: (c) => (c.source === 'checklist' ? c.cardId : null),
	ticking: () => false
};

registerWidgetKind(progressKind);

// A widget copied together with its card (or inserted from a template) follows the copy; copied
// alone, it keeps counting the original card.
cloneHooks.push((el, idMap) => {
	if (el.type !== 'widget' || el.kind !== 'progress') return el;
	const c = progressKind.parseConfig(el.config);
	const cardId = c.cardId && idMap.get(c.cardId);
	return cardId ? { ...el, config: { ...c, cardId } } : el;
});
