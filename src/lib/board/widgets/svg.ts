// Small helpers for the SVG markup widgets draw (face.ts and each kind's `art`).

export const n = (v: number): string => String(Math.round(v * 100) / 100);

export function escapeXml(s: string): string {
	return s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Cuts `s` with an ellipsis to fit `maxW` (average glyph width ≈ 0.55em; good enough for labels). */
export function fitText(s: string, size: number, maxW: number): string {
	const max = Math.max(1, Math.floor(maxW / (size * 0.55)));
	return s.length > max ? `${s.slice(0, Math.max(1, max - 1))}…` : s;
}

/** A `<text>` element; `attrs` are extra raw attributes. */
export function text(
	x: number,
	y: number,
	s: string,
	size: number,
	fill: string,
	attrs = ''
): string {
	return `<text x="${n(x)}" y="${n(y)}" font-size="${n(size)}" fill="${fill}"${attrs ? ` ${attrs}` : ''}>${escapeXml(s)}</text>`;
}

/** Ease out (cubic) of t ∈ [0, 1]. */
export const easeOut = (t: number): number => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
