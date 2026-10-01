import { describe, expect, it } from 'vitest';
import type { Element } from '$lib/model/types';
import { mentionItems, mentionLabel } from './mentions';

const el = (id: string, type: string, fields: Record<string, unknown>) =>
	({ id, type, ...fields }) as unknown as Element;

const elements = [
	el('f', 'frame', { title: 'Login screens' }),
	el('d', 'doccard', { title: 'Release plan' }),
	el('s', 'sticky', { text: 'Login flow\nwith   SSO' }),
	el('t', 'text', { text: '   ' }),
	el('r', 'shape', { text: 'Big login button' }),
	el('c', 'connector', { label: { text: 'login' } }),
	el('i', 'image', {}),
	el('long', 'shape', { text: 'x'.repeat(60) })
];

describe('mentionItems', () => {
	it('ranks prefix matches before substring matches', () => {
		expect(mentionItems(elements, 'log').map((i) => i.id)).toEqual(['s', 'f', 'r']);
	});

	it('excludes empty texts, connectors and images', () => {
		const ids = mentionItems(elements, '').map((i) => i.id);
		expect(ids).not.toContain('t');
		expect(ids).not.toContain('c');
		expect(ids).not.toContain('i');
	});

	it('limits the result and shortens labels to one line of 40 characters', () => {
		expect(mentionItems(elements, '', 3)).toHaveLength(3);
		expect(mentionLabel(elements[2]!)).toBe('Login flow with SSO');
		expect(mentionLabel(elements[7]!)).toHaveLength(40);
	});

	it('is case-insensitive', () => {
		expect(mentionItems(elements, 'RELEASE').map((i) => i.id)).toEqual(['d']);
	});
});
