/** Structural equality for JSON-like values (the only kind stored in element fields). */
export function jsonEqual(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) return true;
	if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	if (Array.isArray(a) && Array.isArray(b)) {
		return a.length === b.length && a.every((v, i) => jsonEqual(v, b[i]));
	}
	const ka = Object.keys(a);
	const kb = Object.keys(b);
	if (ka.length !== kb.length) return false;
	const ra = a as Record<string, unknown>;
	const rb = b as Record<string, unknown>;
	return ka.every((k) => Object.hasOwn(rb, k) && jsonEqual(ra[k], rb[k]));
}
