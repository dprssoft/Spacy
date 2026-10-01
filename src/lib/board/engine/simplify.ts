/**
 * Ramer–Douglas–Peucker simplification of a flat [x, y, pressure, …] list. Distances use x/y only;
 * kept points keep their pressure. The first and last points are always kept.
 */
export function simplifyRDP(points: readonly number[], epsilon: number): number[] {
	const n = Math.floor(points.length / 3);
	if (n <= 2) return points.slice(0, n * 3);
	const keep = new Uint8Array(n);
	keep[0] = 1;
	keep[n - 1] = 1;

	const stack: [number, number][] = [[0, n - 1]];
	while (stack.length) {
		const [first, last] = stack.pop()!;
		const ax = points[first * 3]!;
		const ay = points[first * 3 + 1]!;
		const bx = points[last * 3]!;
		const by = points[last * 3 + 1]!;
		const dx = bx - ax;
		const dy = by - ay;
		const len2 = dx * dx + dy * dy;
		let maxDist = -1;
		let index = -1;
		for (let i = first + 1; i < last; i++) {
			const px = points[i * 3]!;
			const py = points[i * 3 + 1]!;
			let dist: number;
			if (len2 === 0) dist = Math.hypot(px - ax, py - ay);
			else dist = Math.abs(dy * px - dx * py + bx * ay - by * ax) / Math.sqrt(len2);
			if (dist > maxDist) {
				maxDist = dist;
				index = i;
			}
		}
		if (index >= 0 && maxDist > epsilon) {
			keep[index] = 1;
			stack.push([first, index], [index, last]);
		}
	}

	const out: number[] = [];
	for (let i = 0; i < n; i++) {
		if (keep[i]) out.push(points[i * 3]!, points[i * 3 + 1]!, points[i * 3 + 2]!);
	}
	return out;
}
