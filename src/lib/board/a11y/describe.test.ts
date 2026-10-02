import { describe, expect, it } from 'vitest';
import { samples } from '$lib/model/testFixtures';
import { describeChange, describeSelection, describeTool, elementName } from './describe';

describe('announcements', () => {
	const rect = samples.shape('a');
	const sticky = samples.sticky('b');
	it('names elements', () => {
		expect(elementName(rect)).toBe('rectangle');
		expect(elementName({ ...rect, kind: 'database' })).toBe('database');
		expect(elementName(samples.doccard('d'))).toBe('doc card');
		expect(elementName(samples.stroke('s'))).toBe('drawing');
	});
	it('describes the selection', () => {
		expect(describeSelection([])).toBe('Selection cleared');
		expect(describeSelection([sticky])).toBe('Sticky note selected');
		expect(describeSelection([rect, sticky, { ...rect, id: 'c' }])).toBe(
			'3 elements selected: rectangle, sticky note'
		);
	});
	it('describes creation, deletion and tools', () => {
		expect(describeChange('created', [sticky])).toBe('Sticky note created');
		expect(describeChange('deleted', [rect, sticky])).toBe('2 elements deleted');
		expect(describeChange('deleted', [])).toBe('');
		expect(describeTool('shape', 'Rectangle')).toBe('Rectangle tool');
		expect(describeTool('doccard')).toBe('Doc card tool');
	});
});
