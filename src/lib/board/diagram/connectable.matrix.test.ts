import { describe, expect, it } from 'vitest';
import type { Element, Point } from '$lib/model/types';
import { allDefinitions } from '../elements';
import { sampleElements } from '../elements/fixtures';
import { nearestPointOnPolygon, polygonContains, rectCenter } from '../engine/geometry';
import { nearestPort, PORTS } from './index';

const ROTATIONS = [0, Math.PI / 4, Math.PI / 2];
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const cases = allDefinitions().flatMap((def) =>
	sampleElements(def.type).flatMap((el) =>
		ROTATIONS.map((rotation) => ({
			name: `${el.type === 'shape' ? `shape:${el.kind}` : el.type} @ ${Math.round((rotation * 180) / Math.PI)}°`,
			def,
			el: { ...el, rotation } as Element
		}))
	)
);

describe('every element type is connectable (except connectors)', () => {
	it('covers all registered types', () => {
		const types = new Set(allDefinitions().map((d) => d.type));
		expect(types).toEqual(
			new Set([
				'shape',
				'sticky',
				'text',
				'image',
				'stroke',
				'sketch',
				'frame',
				'doccard',
				'connector',
				'media',
				'waystone'
			])
		);
		for (const d of allDefinitions()) {
			if (d.type === 'connector') expect(d.connectable).toBeNull();
			else expect(d.connectable, `${d.type} must be connectable`).not.toBeNull();
		}
	});

	const connectable = cases.filter((c) => c.def.connectable);

	it.each(connectable)(
		'$name: ports lie on the outline with outward unit normals',
		({ def, el }) => {
			const c = def.connectable!;
			const poly = c.outline(el);
			const center = rectCenter(el);
			const ports = c.ports(el);
			for (const port of PORTS) {
				const p = ports[port];
				expect(dist(nearestPointOnPolygon(poly, p), p)).toBeLessThan(0.5);
				const n = c.portNormal(el, port);
				expect(Math.hypot(n.x, n.y)).toBeCloseTo(1, 6);
				// Outward: moving along the normal leaves the shape, and goes away from the center.
				const out = { x: p.x + n.x * 10, y: p.y + n.y * 10 };
				expect(polygonContains(poly, out)).toBe(false);
				expect(dist(out, center)).toBeGreaterThan(dist(p, center));
			}
		}
	);

	it.each(connectable)('$name: ray exits lie on the outline, toward the target', ({ def, el }) => {
		const c = def.connectable!;
		const poly = c.outline(el);
		const center = rectCenter(el);
		for (let i = 0; i < 8; i++) {
			const a = (i / 8) * Math.PI * 2 + 0.1;
			const toward = { x: center.x + Math.cos(a) * 1000, y: center.y + Math.sin(a) * 1000 };
			const p = c.rayExit(el, toward);
			expect(dist(nearestPointOnPolygon(poly, p), p)).toBeLessThan(0.5);
			const dot =
				(p.x - center.x) * (toward.x - center.x) + (p.y - center.y) * (toward.y - center.y);
			expect(dot).toBeGreaterThan(0);
		}
	});

	it.each(connectable)('$name: local ↔ world round-trips', ({ def, el }) => {
		const c = def.connectable!;
		for (const u of [0, 0.25, 0.5, 1]) {
			for (const v of [0, 0.5, 0.9]) {
				const back = c.worldToLocal(el, c.localToWorld(el, u, v));
				expect(back.u).toBeCloseTo(u, 6);
				expect(back.v).toBeCloseTo(v, 6);
			}
		}
	});
});

describe('nearestPort', () => {
	it('finds the port within the radius', () => {
		const [rect] = sampleElements('sticky');
		// Unrotated box 100..260 × 60..160: east port at (260, 110).
		expect(nearestPort(rect!, { x: 258, y: 112 }, 8)).toBe('e');
		expect(nearestPort(rect!, { x: 200, y: 110 }, 8)).toBeNull();
	});
});
