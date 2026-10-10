import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { getMeta } from './doc';
import { getShare, newShare, parseShareHash, setShare, shareHash } from './share';

describe('share', () => {
	it('round-trips a link hash', () => {
		const share = newShare();
		expect(parseShareHash(`#${shareHash(share)}`)).toEqual(share);
		expect(parseShareHash(shareHash(share))).toEqual(share);
	});

	it('rejects malformed hashes', () => {
		const { room, key } = newShare();
		for (const bad of [
			'',
			'#',
			'#live=',
			`#live=${room}`,
			`#live=${room}.short`,
			`#live=a.${key}`,
			`#x=${room}.${key}`,
			`#live=${room}.${key}&x`
		]) {
			expect(parseShareHash(bad)).toBeNull();
		}
	});

	it('stores and clears the share on the board', () => {
		const doc = new Y.Doc();
		expect(getShare(doc)).toBeNull();
		const share = newShare();
		setShare(doc, share);
		expect(getShare(doc)).toEqual(share);
		setShare(doc, null);
		expect(getShare(doc)).toBeNull();
		getMeta(doc).set('share', { room: 'x', key: 'y' });
		expect(getShare(doc)).toBeNull();
	});
});
