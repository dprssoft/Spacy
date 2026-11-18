import { z } from '$lib/shared/zod';
import { registerWidgetKind, type WidgetKind } from '../kinds';
import { escapeXml, fitText, text } from '../svg';

// A status chip. A click moves it to the next option; that's an edit of the board (config,
// undoable), like changing a sticky's color.

export const MAX_STATUS_LABEL = 24;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 8;
export const STATUS_COLORS = [
	'#2f9e44',
	'#f08c00',
	'#e03131',
	'#1971c2',
	'#7048e8',
	'#0c8599',
	'#868e96',
	'#c2255c'
];

const optionSchema = z.object({
	label: z.string().trim().min(1).max(MAX_STATUS_LABEL),
	color: z.string().regex(/^#[0-9a-f]{6}$/i)
});
const configSchema = z.object({
	options: z.array(optionSchema).min(MIN_OPTIONS).max(MAX_OPTIONS),
	value: z.number().int()
});

export type StatusOption = z.infer<typeof optionSchema>;
export type StatusConfig = z.infer<typeof configSchema>;

export const DEFAULT_STATUS: StatusConfig = {
	options: [
		{ label: 'On track', color: '#2f9e44' },
		{ label: 'At risk', color: '#f08c00' },
		{ label: 'Blocked', color: '#e03131' },
		{ label: 'Done', color: '#1971c2' }
	],
	value: 0
};

const clamp = (c: StatusConfig): StatusConfig => ({
	...c,
	value: Math.min(c.options.length - 1, Math.max(0, c.value))
});

export const parseStatus = (raw: unknown): StatusConfig =>
	clamp(configSchema.catch(DEFAULT_STATUS).parse(raw));

export const currentOption = (c: StatusConfig): StatusOption => c.options[c.value]!;

/** The config after a click: the next option, wrapping around. */
export const nextStatus = (c: StatusConfig): StatusConfig => ({
	...c,
	value: (c.value + 1) % c.options.length
});

/** Options edited in the settings; the selected one stays selected while it exists. */
export function withOptions(c: StatusConfig, options: StatusOption[]): StatusConfig {
	return clamp({ ...c, options: options.slice(0, MAX_OPTIONS) });
}

const DESIGN = { w: 120, h: 32 };

export const statusKind: WidgetKind<StatusConfig, null> = {
	kind: 'status',
	label: 'Status',
	group: 'Team',
	design: DESIGN,
	parseConfig: parseStatus,
	parseState: () => null,
	defaultConfig: () => structuredClone(DEFAULT_STATUS),
	defaultState: () => null,
	face(c, _s, _now, title) {
		return {
			headline: currentOption(c).label,
			caption: title || 'Status',
			ring: null,
			accent: currentOption(c).color
		};
	},
	art(c) {
		const o = currentOption(c);
		return (
			`<rect x="0" y="0" width="${DESIGN.w}" height="${DESIGN.h}" rx="${DESIGN.h / 2}" fill="${escapeXml(o.color)}"/>` +
			text(
				DESIGN.w / 2,
				21,
				fitText(o.label, 14, DESIGN.w - 20),
				14,
				'#ffffff',
				'text-anchor="middle" font-weight="600"'
			)
		);
	},
	actions: (c) => [
		{
			id: 'next',
			label: `Status: ${currentOption(c).label}. Next status`,
			glyph: { text: '' },
			rect: { x: 0, y: 0, ...DESIGN },
			primary: true,
			// The whole chip is the button.
			bare: true
		}
	],
	perform(action, c) {
		if (action !== 'next') return null;
		const next = nextStatus(c);
		return { config: next, announce: `Status: ${currentOption(next).label}` };
	},
	ticking: () => false
};

registerWidgetKind(statusKind);
