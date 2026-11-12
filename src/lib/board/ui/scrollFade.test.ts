import { describe, expect, it } from 'vitest';
import { fadeMask } from './scrollFade';

describe('fadeMask', () => {
	it('is none when everything fits', () => {
		expect(fadeMask(0, 300, 300)).toBe('none');
	});
	it('fades only the right edge at the start', () => {
		const m = fadeMask(0, 600, 300);
		expect(m).toContain('#000 calc(100% - 32px), transparent');
		expect(m).not.toContain('transparent, #000 32px');
	});
	it('fades only the left edge at the end', () => {
		const m = fadeMask(300, 600, 300);
		expect(m).toContain('transparent, #000 32px');
		expect(m).not.toContain('calc(100% - 32px), transparent');
	});
	it('fades both edges in the middle', () => {
		const m = fadeMask(150, 600, 300);
		expect(m).toContain('transparent, #000 32px');
		expect(m).toContain('calc(100% - 32px), transparent');
	});
});
