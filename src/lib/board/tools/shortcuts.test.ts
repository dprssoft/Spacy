import { describe, expect, it } from 'vitest';
import { isTypingTarget, matchesKeys } from './shortcuts';

function key(init: KeyboardEventInit) {
	return new KeyboardEvent('keydown', init);
}

describe('matchesKeys', () => {
	it('maps Mod to Ctrl off macOS and Cmd on macOS', () => {
		expect(matchesKeys(key({ key: 'z', code: 'KeyZ', ctrlKey: true }), 'Mod+Z', false)).toBe(true);
		expect(matchesKeys(key({ key: 'z', code: 'KeyZ', metaKey: true }), 'Mod+Z', false)).toBe(false);
		expect(matchesKeys(key({ key: 'z', code: 'KeyZ', metaKey: true }), 'Mod+Z', true)).toBe(true);
		expect(matchesKeys(key({ key: 'z', code: 'KeyZ', ctrlKey: true }), 'Mod+Z', true)).toBe(false);
	});

	it('requires exact Shift and Alt state for letters', () => {
		const e = key({ key: 'Z', code: 'KeyZ', ctrlKey: true, shiftKey: true });
		expect(matchesKeys(e, 'Mod+Shift+Z', false)).toBe(true);
		expect(matchesKeys(e, 'Mod+Z', false)).toBe(false);
		expect(matchesKeys(key({ key: 'r', code: 'KeyR', altKey: true }), 'R', false)).toBe(false);
	});

	it('ignores Caps Lock and Alt-changed characters for letters', () => {
		expect(matchesKeys(key({ key: 'R', code: 'KeyR' }), 'R', false)).toBe(true);
		expect(
			matchesKeys(key({ key: 'ç', code: 'KeyC', altKey: true, metaKey: true }), 'Mod+Alt+C', true)
		).toBe(true);
	});

	it('matches Shift+digit by code', () => {
		expect(matchesKeys(key({ key: '!', code: 'Digit1', shiftKey: true }), 'Shift+1', false)).toBe(
			true
		);
		expect(matchesKeys(key({ key: '1', code: 'Digit1' }), 'Shift+1', false)).toBe(false);
		expect(matchesKeys(key({ key: '0', code: 'Digit0', ctrlKey: true }), 'Mod+0', false)).toBe(
			true
		);
	});

	it('matches punctuation regardless of Shift', () => {
		expect(matchesKeys(key({ key: ']', code: 'BracketRight' }), ']', false)).toBe(true);
		expect(matchesKeys(key({ key: '?', code: 'Slash', shiftKey: true }), '?', false)).toBe(true);
		expect(matchesKeys(key({ key: '=', code: 'Equal', ctrlKey: true }), 'Mod+=', false)).toBe(true);
		expect(
			matchesKeys(key({ key: '+', code: 'Equal', ctrlKey: true, shiftKey: true }), 'Mod++', false)
		).toBe(true);
	});

	it('matches named keys', () => {
		expect(matchesKeys(key({ key: 'Delete' }), 'Delete', false)).toBe(true);
		expect(matchesKeys(key({ key: 'Escape' }), 'Escape', false)).toBe(true);
		expect(matchesKeys(key({ key: ' ', code: 'Space' }), 'Space', false)).toBe(true);
		expect(matchesKeys(key({ key: 'Backspace' }), 'Delete', false)).toBe(false);
	});
});

describe('isTypingTarget', () => {
	it('detects inputs, textareas, selects and contenteditable', () => {
		expect(isTypingTarget(document.createElement('input'))).toBe(true);
		expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
		expect(isTypingTarget(document.createElement('select'))).toBe(true);
		const div = document.createElement('div');
		expect(isTypingTarget(div)).toBe(false);
		div.setAttribute('contenteditable', 'true');
		document.body.append(div);
		expect(isTypingTarget(div)).toBe(true);
		div.remove();
		expect(isTypingTarget(null)).toBe(false);
	});
});
