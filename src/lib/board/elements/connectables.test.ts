import { describe, expect, it } from 'vitest';
import type { ElementType } from '$lib/model/types';
import { connectableFor } from './connectables';
import { sampleElements } from './fixtures';
import { definitionOf } from './index';

const TYPES: ElementType[] = [
	'shape',
	'sticky',
	'text',
	'image',
	'stroke',
	'frame',
	'doccard',
	'connector'
];

describe('connectableFor', () => {
	it('matches the registry for every element type', () => {
		for (const el of TYPES.flatMap(sampleElements)) {
			const pure = connectableFor(el);
			const reg = definitionOf(el).connectable;
			if (!reg) {
				expect(pure).toBeNull();
				continue;
			}
			expect(pure!.ports(el)).toEqual(reg.ports(el));
			expect(pure!.outline(el)).toEqual(reg.outline(el));
		}
	});
});
