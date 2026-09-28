import { describe, expect, it } from 'vitest';

describe('test environment', () => {
	it('provides IndexedDB and a DOM', () => {
		expect(globalThis.indexedDB).toBeDefined();
		expect(document.createElement('div')).toBeInstanceOf(HTMLElement);
	});
});
