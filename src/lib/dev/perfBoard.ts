import { baseStyleFor, STICKY_COLORS } from '$lib/model/defaults';
import type { NewElement, ShapeKind } from '$lib/model/types';

/** Deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const KINDS: ShapeKind[] = ['rect', 'ellipse', 'diamond'];
const STICKIES = Object.values(STICKY_COLORS);
const FILLS = ['#ffffff', '#a5d8ff', '#b2f2bb', '#ffec99', '#ffc9c9', '#d0bfff'];

/** Shapes, stickies and texts spread over a 10,000 × 10,000 area, for performance testing. */
export function generatePerfElements(n = 3000, seed = 1): NewElement[] {
	const r = rng(seed);
	const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
	const out: NewElement[] = [];
	for (let i = 0; i < n; i++) {
		const x = r() * 10_000 - 5000;
		const y = r() * 10_000 - 5000;
		const base = {
			id: `perf-${seed}-${i}`,
			x,
			y,
			rotation: r() < 0.1 ? (r() - 0.5) * 0.6 : 0,
			parentId: null,
			groupId: null,
			locked: false
		};
		const roll = r();
		if (roll < 0.5) {
			const style = { ...baseStyleFor('shape'), fill: pick(FILLS) };
			out.push({
				...base,
				type: 'shape',
				kind: pick(KINDS),
				w: 80 + r() * 160,
				h: 60 + r() * 100,
				text: r() < 0.5 ? `Shape ${i}` : '',
				style
			});
		} else if (roll < 0.8) {
			out.push({
				...base,
				type: 'sticky',
				w: 200,
				h: 200,
				color: pick(STICKIES),
				text: `Idea #${i}\nSome notes here`,
				style: baseStyleFor('sticky')
			});
		} else {
			out.push({
				...base,
				type: 'text',
				w: 160,
				h: 24,
				autoWidth: true,
				text: `Label ${i}`,
				style: baseStyleFor('text')
			});
		}
	}
	return out;
}
