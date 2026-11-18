import { describe, expect, it } from 'vitest';
import { samples } from '$lib/model/testFixtures';
import { widgetView } from '../kinds';
import {
	currentOption,
	DEFAULT_STATUS,
	nextStatus,
	parseStatus,
	statusKind,
	withOptions
} from './status';
import '../index';

describe('status', () => {
	it('cycles through the options and wraps', () => {
		let c = DEFAULT_STATUS;
		const seen = [currentOption(c).label];
		for (let i = 0; i < 4; i++) {
			c = nextStatus(c);
			seen.push(currentOption(c).label);
		}
		expect(seen).toEqual(['On track', 'At risk', 'Blocked', 'Done', 'On track']);
		expect(statusKind.perform('next', DEFAULT_STATUS, null, 0, 0)).toEqual({
			config: { ...DEFAULT_STATUS, value: 1 },
			announce: 'Status: At risk'
		});
	});

	it('clamps the value when options are removed', () => {
		const done = { ...DEFAULT_STATUS, value: 3 };
		expect(withOptions(done, DEFAULT_STATUS.options.slice(0, 2)).value).toBe(1);
		expect(parseStatus({ ...DEFAULT_STATUS, value: 9 }).value).toBe(3);
		expect(parseStatus({ ...DEFAULT_STATUS, value: -2 }).value).toBe(0);
		expect(parseStatus({ options: [DEFAULT_STATUS.options[0]], value: 0 })).toEqual(DEFAULT_STATUS);
	});

	it('is one chip-sized button that the art draws', () => {
		const view = widgetView(
			{ ...samples.widget('s'), kind: 'status', config: DEFAULT_STATUS, state: null },
			0
		);
		expect(view.actions).toHaveLength(1);
		expect(view.actions[0]).toMatchObject({ id: 'next', primary: true, bare: true });
		expect(view.art).toContain('On track');
	});
});
