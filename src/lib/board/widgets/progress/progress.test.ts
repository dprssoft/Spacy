import { describe, expect, it } from 'vitest';
import { cloneElements } from '$lib/model/clone';
import { samples } from '$lib/model/testFixtures';
import type { Element, WidgetElement } from '$lib/model/types';
import { NO_ENV, widgetView } from '../kinds';
import { DEFAULT_PROGRESS, progressKind, readProgress, valueAt } from './progress';
import '../index';

const env = { tasks: (id: string) => (id === 'card' ? { done: 1, total: 4 } : null) };

describe('progress', () => {
	it('reads a manual value or a linked checklist', () => {
		expect(readProgress({ ...DEFAULT_PROGRESS, value: 40 }, NO_ENV).percent).toBe(40);
		const linked = { ...DEFAULT_PROGRESS, source: 'checklist' as const, cardId: 'card' };
		expect(readProgress(linked, env)).toEqual({ percent: 25, caption: '1 of 4 tasks done' });
		expect(readProgress({ ...linked, cardId: 'other' }, env).caption).toBe('No checklist');
		expect(readProgress({ ...linked, cardId: null }, env).percent).toBeNull();
		expect(progressKind.linkedCard?.(linked)).toBe('card');
		expect(progressKind.linkedCard?.(DEFAULT_PROGRESS)).toBeNull();
	});

	it('drags in 5 % steps, or 1 % with Shift, and clamps', () => {
		expect(valueAt(16 + 228 * 0.42, false)).toBe(40);
		expect(valueAt(16 + 228 * 0.42, true)).toBe(42);
		expect(valueAt(-50, false)).toBe(0);
		expect(valueAt(999, false)).toBe(100);
		expect(progressKind.dragTo?.('set', DEFAULT_PROGRESS, { x: 130, y: 60 }, false)).toEqual({
			...DEFAULT_PROGRESS,
			value: 50
		});
		// No change, or not set by hand: nothing to write.
		expect(progressKind.dragTo?.('set', DEFAULT_PROGRESS, { x: 16, y: 60 }, false)).toBeNull();
		expect(
			progressKind.dragTo?.(
				'set',
				{ ...DEFAULT_PROGRESS, source: 'checklist' },
				{ x: 130, y: 60 },
				false
			)
		).toBeNull();
	});

	it('has a drag zone only on a manual bar', () => {
		const view = (config: object) =>
			widgetView({ ...samples.widget('p'), kind: 'progress', config, state: null }, 0, true, env);
		expect(view(DEFAULT_PROGRESS).actions.map((a) => [a.id, a.drag])).toEqual([['set', true]]);
		expect(view({ ...DEFAULT_PROGRESS, look: 'ring' }).actions).toEqual([]);
		const linked = view({ ...DEFAULT_PROGRESS, source: 'checklist', cardId: 'card' });
		expect(linked.actions).toEqual([]);
		expect(linked.face.headline).toBe('25%');
		expect(linked.art).toContain('1 of 4 tasks done');
	});
});

describe('copying a linked progress widget', () => {
	const card = { ...samples.doccard('card'), z: 'a' } as Element;
	const widget = {
		...samples.widget('p'),
		kind: 'progress',
		config: { ...DEFAULT_PROGRESS, source: 'checklist', cardId: 'card' },
		z: 'b'
	} as Element;
	const cardIdOf = (els: readonly unknown[], i: number) =>
		((els[i] as WidgetElement).config as { cardId: string }).cardId;

	it('follows the copy of its card', () => {
		const { elements, idMap } = cloneElements([card, widget], { offset: { x: 10, y: 10 } });
		expect(cardIdOf(elements, 1)).toBe(idMap.get('card'));
	});

	it('copied alone, keeps the original card', () => {
		const { elements } = cloneElements([widget], { offset: { x: 10, y: 10 } });
		expect(cardIdOf(elements, 0)).toBe('card');
	});
});
