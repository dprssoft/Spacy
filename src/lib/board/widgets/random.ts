// Seeded randomness for chance widgets. A widget stores the seed and the result it led to, so
// every tab and peer shows the same draw; the helpers are deterministic for a given seed.

/** mulberry32: a small, fast 32-bit generator. Returns floats in [0, 1). */
export function rng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** A whole number in [0, n). */
export const int = (r: () => number, n: number): number => Math.floor(r() * n);

/** A shuffled copy (Fisher–Yates). */
export function shuffle<T>(items: readonly T[], r: () => number): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = int(r, i + 1);
		[out[i], out[j]] = [out[j]!, out[i]!];
	}
	return out;
}

/** `k` different items in random order. */
export const pick = <T>(items: readonly T[], k: number, r: () => number): T[] =>
	shuffle(items, r).slice(0, Math.max(0, k));

/** Items dealt into `n` teams whose sizes differ by at most one. */
export function teams<T>(items: readonly T[], n: number, r: () => number): T[][] {
	const count = Math.max(1, Math.min(n, items.length || 1));
	const out: T[][] = Array.from({ length: count }, () => []);
	shuffle(items, r).forEach((item, i) => out[i % count]!.push(item));
	return out;
}

/** A 32-bit value derived from a seed and a step, for animations that must agree across peers. */
export const mix = (seed: number, step: number): number =>
	(Math.imul(seed ^ (step * 0x9e3779b9), 0x85ebca6b) ^ (seed >>> 13)) >>> 0;
