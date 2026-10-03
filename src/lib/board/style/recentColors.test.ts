import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
	localStorage.clear();
	vi.resetModules();
});

const load = async () => (await import('./recentColors.svelte')).recentColors;

describe('recentColors', () => {
	it('keeps the latest ten, newest first, without duplicates, across reloads', async () => {
		const recent = await load();
		for (let i = 0; i < 12; i++) recent.add(`#0000${i.toString().padStart(2, '0')}`);
		recent.add('#000005');
		recent.add('not a color');
		expect(recent.list).toHaveLength(10);
		expect(recent.list[0]).toBe('#000005');
		expect(new Set(recent.list).size).toBe(10);
		expect((await load()).list).toEqual(recent.list);
	});

	it('ignores garbage in storage', async () => {
		localStorage.setItem('smthng:recentColors', JSON.stringify(['#ABC', 5, 'x', null]));
		expect((await load()).list).toEqual(['#aabbcc']);
	});
});
