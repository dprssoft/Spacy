import { describe, expect, it } from 'vitest';
import { getElementsMap, listElements } from '$lib/model/doc';
import { parseSmthngFile } from '$lib/storage/fileFormat';
import { buildVisualBoard, buildVisualBoardFile } from './visualFixture';

describe('visual fixture', () => {
	it('contains every element type, routing and marker, all valid', () => {
		const doc = buildVisualBoard();
		const els = listElements(doc);
		expect(els).toHaveLength(getElementsMap(doc).size); // nothing invalid
		expect(new Set(els.map((e) => e.type))).toEqual(
			new Set(['frame', 'shape', 'sticky', 'text', 'image', 'stroke', 'doccard', 'connector'])
		);
		const conns = els.filter((e) => e.type === 'connector');
		expect(new Set(conns.map((c) => c.routing))).toEqual(new Set(['straight', 'elbow', 'curve']));
		expect(new Set(conns.flatMap((c) => [c.markerStart, c.markerEnd])).size).toBe(7);
	});

	it('is a valid .smthng file', () => {
		const file = buildVisualBoardFile({ base64: 'AAAA', width: 2, height: 2 });
		expect(parseSmthngFile(file).boards[0]?.title).toBe('Visual fixture');
	});
});
