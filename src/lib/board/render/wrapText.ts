export type Measure = (text: string) => number;

/**
 * Splits text into lines no wider than `maxWidth`: explicit newlines are kept, lines break at
 * spaces, and words wider than a line are broken by character.
 */
export function wrapText(text: string, maxWidth: number, measure: Measure): string[] {
	const out: string[] = [];
	for (const para of text.split('\n')) {
		if (!Number.isFinite(maxWidth) || measure(para) <= maxWidth) {
			out.push(para);
			continue;
		}
		let line = '';
		for (const word of para.split(/(?<= )/)) {
			const candidate = line + word;
			if (measure(candidate.trimEnd()) <= maxWidth) {
				line = candidate;
				continue;
			}
			if (line) out.push(line.trimEnd());
			// A word wider than the line: break it by character.
			let rest = word;
			while (measure(rest.trimEnd()) > maxWidth && rest.length > 1) {
				let n = 1;
				while (n < rest.length && measure(rest.slice(0, n + 1)) <= maxWidth) n++;
				out.push(rest.slice(0, n));
				rest = rest.slice(n);
			}
			line = rest;
		}
		out.push(line.trimEnd());
	}
	return out;
}

export interface FontSpec {
	size: number;
	bold?: boolean;
	italic?: boolean;
	family: string;
}

export const cssFont = (f: FontSpec) =>
	`${f.italic ? 'italic ' : ''}${f.bold ? 700 : 400} ${f.size}px ${f.family}`;

/** Text width via canvas `measureText`; an average-glyph estimate where no canvas exists. */
export function createCanvasMeasurer(): (text: string, font: FontSpec) => number {
	let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;
	try {
		if (typeof OffscreenCanvas !== 'undefined') ctx = new OffscreenCanvas(1, 1).getContext('2d');
		else if (typeof document !== 'undefined')
			ctx = document.createElement('canvas').getContext('2d');
	} catch {
		ctx = null;
	}
	return (text, font) => {
		if (!ctx) return text.length * font.size * 0.55;
		ctx.font = cssFont(font);
		return ctx.measureText(text).width;
	};
}
