const UNITS = ['B', 'KB', 'MB', 'GB'];

/** "12.3 MB": one decimal from KB up. */
export function formatBytes(bytes: number): string {
	let v = Math.max(0, bytes);
	let u = 0;
	while (v >= 1024 && u < UNITS.length - 1) {
		v /= 1024;
		u++;
	}
	return `${u === 0 ? Math.round(v) : v.toFixed(1)} ${UNITS[u]}`;
}
