import { afterEach, describe, expect, it, vi } from 'vitest';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { colorFor, readPeers, throttle } from './presenceData';

function linked() {
	const a = new Awareness(new Y.Doc());
	const b = new Awareness(new Y.Doc());
	const pipe = (from: Awareness, to: Awareness) =>
		from.on('update', ({ added, updated, removed }: Record<string, number[]>) => {
			const changed = [...added!, ...updated!, ...removed!];
			applyAwarenessUpdate(to, encodeAwarenessUpdate(from, changed), 'remote');
		});
	pipe(a, b);
	pipe(b, a);
	return { a, b };
}

afterEach(() => vi.useRealTimers());

describe('presence', () => {
	it('shows the others with their name, color and cursor', () => {
		const { a, b } = linked();
		b.setLocalStateField('user', { name: 'Bo', color: '#2f9e44' });
		b.setLocalStateField('cursor', { x: 10, y: 20, page: 'main' });
		expect(readPeers(a)).toEqual([
			{ clientId: b.clientID, name: 'Bo', color: '#2f9e44', cursor: { x: 10, y: 20, page: 'main' } }
		]);
		expect(readPeers(b)).toEqual([]);
	});

	it('ignores malformed states and falls back to a safe color', () => {
		const { a, b } = linked();
		b.setLocalStateField('user', { name: 'Bo', color: 'url(javascript:x)' });
		b.setLocalStateField('cursor', { x: 'no' });
		expect(readPeers(a)[0]).toMatchObject({ color: colorFor(b.clientID), cursor: null });
	});

	it('forgets someone who leaves', () => {
		const { a, b } = linked();
		b.setLocalStateField('user', { name: 'Bo', color: '#2f9e44' });
		expect(readPeers(a)).toHaveLength(1);
		b.setLocalState(null);
		expect(readPeers(a)).toEqual([]);
	});

	it('throttles pointer updates and sends the last one', () => {
		vi.useFakeTimers();
		const sent: number[] = [];
		const send = throttle((v: number) => sent.push(v), 50);
		send(1);
		send(2);
		send(3);
		expect(sent).toEqual([1]);
		vi.advanceTimersByTime(50);
		expect(sent).toEqual([1, 3]);
	});
});
