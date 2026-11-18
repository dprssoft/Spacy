import { z } from '$lib/shared/zod';
import { registerWidgetKind, type WidgetKind } from '../kinds';
import { fitText, text } from '../svg';

// A deadline badge: "In 3 days", "Today", "2 days overdue". Days are counted between calendar
// dates in the viewer's own time zone, so a DST change or midnight never shifts them.

export const MAX_DEADLINE_LABEL = 40;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const validDate = (s: string) => {
	const [y, m, d] = s.split('-').map(Number) as [number, number, number];
	const t = new Date(y, m - 1, d);
	return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d;
};

const configSchema = z.object({
	date: z.string().regex(DATE).refine(validDate),
	time: z.string().regex(TIME).nullable(),
	label: z.string().max(MAX_DEADLINE_LABEL)
});

export type DeadlineConfig = z.infer<typeof configSchema>;
export type DeadlineTone = 'neutral' | 'soon' | 'overdue';

const DAY = 86_400_000;
const SOON_DAYS = 2;
export const TONE_COLORS: Record<Exclude<DeadlineTone, 'neutral'>, string> = {
	soon: '#f08c00',
	overdue: '#e03131'
};
const MUTED = '#868e96';

/** A local date as YYYY-MM-DD. */
export function isoDate(t: Date): string {
	const p = (v: number) => String(v).padStart(2, '0');
	return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

/** A week from today. */
export function defaultDeadline(now = Date.now()): DeadlineConfig {
	const t = new Date(now);
	return {
		date: isoDate(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 7)),
		time: null,
		label: ''
	};
}

const parts = (date: string) => date.split('-').map(Number) as [number, number, number];

/** When it's due (epoch ms, local time): at its time, or at the end of its day. */
export function dueAt(c: DeadlineConfig): number {
	const [y, m, d] = parts(c.date);
	if (c.time === null) return new Date(y, m - 1, d + 1).getTime() - 1;
	const [hh, mm] = c.time.split(':').map(Number) as [number, number];
	return new Date(y, m - 1, d, hh, mm).getTime();
}

/** Calendar days from today to the date (negative: in the past). */
export function daysUntil(date: string, now: number): number {
	const [y, m, d] = parts(date);
	const t = new Date(now);
	return Math.round(
		(Date.UTC(y, m - 1, d) - Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())) / DAY
	);
}

export function readDeadline(c: DeadlineConfig, now: number): { text: string; tone: DeadlineTone } {
	const days = daysUntil(c.date, now);
	if (now > dueAt(c)) {
		const late = -days;
		return {
			text: late <= 0 ? 'Overdue' : `${late} day${late === 1 ? '' : 's'} overdue`,
			tone: 'overdue'
		};
	}
	const text = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
	return { text, tone: days <= SOON_DAYS ? 'soon' : 'neutral' };
}

const dateFormat = new Intl.DateTimeFormat('en-GB', {
	weekday: 'short',
	day: 'numeric',
	month: 'short',
	year: 'numeric'
});

/** "Fri 20 Nov 2026" or "Fri 20 Nov 2026 · 17:00". */
export function formatDeadline(c: DeadlineConfig): string {
	const [y, m, d] = parts(c.date);
	const day = dateFormat.format(new Date(y, m - 1, d)).replace(',', '');
	return c.time ? `${day} · ${c.time}` : day;
}

const toneColor = (tone: DeadlineTone, ink: string) =>
	tone === 'neutral' ? ink : TONE_COLORS[tone];

// Design space 220 × 110: the label, the relative time and the date.
export const deadlineKind: WidgetKind<DeadlineConfig, null> = {
	kind: 'deadline',
	label: 'Deadline',
	group: 'Team',
	design: { w: 220, h: 110 },
	parseConfig: (raw) => configSchema.catch(() => defaultDeadline()).parse(raw),
	parseState: () => null,
	defaultConfig: () => defaultDeadline(),
	defaultState: () => null,
	face(c, _s, now, title) {
		const r = readDeadline(c, now);
		return {
			headline: r.text,
			caption: c.label || title || formatDeadline(c),
			ring: null,
			accent: r.tone === 'neutral' ? MUTED : TONE_COLORS[r.tone]
		};
	},
	art(c, _s, now, { ink, title }) {
		const r = readDeadline(c, now);
		const color = toneColor(r.tone, ink);
		// Long texts ("2513 days overdue") get smaller rather than cut.
		// Rounded down to half pixels, so fitText's own estimate agrees that it fits.
		const size = Math.max(14, Math.min(24, Math.floor((190 / (r.text.length * 0.55)) * 2) / 2));
		return (
			`<circle cx="22" cy="27" r="5" fill="${r.tone === 'neutral' ? MUTED : color}"/>` +
			text(
				34,
				32,
				fitText(c.label || title || 'Deadline', 13, 170),
				13,
				MUTED,
				'font-weight="500"'
			) +
			text(16, 68, fitText(r.text, size, 190), size, color, 'font-weight="700"') +
			text(16, 92, formatDeadline(c), 12, MUTED)
		);
	},
	actions: () => [],
	perform: () => null,
	ticking: () => false,
	refreshMs: () => 60_000
};

registerWidgetKind(deadlineKind);
