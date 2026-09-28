/** FNV-1a 32-bit hash. */
function hash(s: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

/** A soft pastel gradient derived deterministically from a board id (thumbnail placeholder). */
export function placeholderGradient(id: string): string {
	const h = hash(id);
	const hue1 = h % 360;
	const hue2 = (hue1 + 40 + ((h >>> 9) % 60)) % 360;
	const sat = 60 + ((h >>> 16) % 11);
	const light1 = 80 + ((h >>> 20) % 9);
	const light2 = 80 + ((h >>> 24) % 9);
	return `linear-gradient(135deg, hsl(${hue1} ${sat}% ${light1}%), hsl(${hue2} ${sat}% ${light2}%))`;
}
