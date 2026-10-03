import type { DocNode } from '../doccards/markdown';

// Word, character and reading-time counts (pure). Words come from Intl.Segmenter when available,
// so languages without spaces (Chinese, Japanese, Thai) count sensibly.

export interface TextStats {
	words: number;
	chars: number;
	charsNoSpaces: number;
}

export interface DocStats extends TextStats {
	paragraphs: number;
	/** Minutes at READING_WPM, rounded up (0 for an empty text). */
	readingMinutes: number;
}

export const READING_WPM = 238;

type Segmenter = { segment(s: string): Iterable<{ segment: string; isWordLike?: boolean }> };
let segmenter: Segmenter | null | undefined;
function wordSegmenter(): Segmenter | null {
	if (segmenter === undefined) {
		const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: object) => Segmenter })
			.Segmenter;
		segmenter = Seg ? new Seg(undefined, { granularity: 'word' }) : null;
	}
	return segmenter;
}

export function countWords(text: string): number {
	if (!text.trim()) return 0;
	const seg = wordSegmenter();
	if (!seg) return text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
	// "well-known" and "it's" are one word each (as in word processors): a hyphen or apostrophe
	// between two word segments joins them.
	let n = 0;
	let joiner = false;
	let prevWord = false;
	for (const s of seg.segment(text)) {
		if (s.isWordLike) {
			if (!(prevWord && joiner)) n++;
			prevWord = true;
			joiner = false;
		} else {
			joiner = prevWord && !joiner && /^['’‐-]$/.test(s.segment);
			if (!joiner) prevWord = false;
		}
	}
	return n;
}

export function textStats(text: string): TextStats {
	const chars = [...text].length;
	const charsNoSpaces = [...text.replace(/\s/g, '')].length;
	return { words: countWords(text), chars, charsNoSpaces };
}

export const readingMinutes = (words: number) => (words === 0 ? 0 : Math.ceil(words / READING_WPM));

/** Plain text of doc JSON: one line per block, mentions by their label. */
export function docText(doc: DocNode): { text: string; paragraphs: number } {
	const lines: string[] = [];
	const inline = (n: DocNode): string => {
		if (n.type === 'text') return n.text ?? '';
		if (n.type === 'mention') return String(n.attrs?.label ?? '');
		if (n.type === 'hardBreak') return '\n';
		return (n.content ?? []).map(inline).join('');
	};
	const walk = (n: DocNode) => {
		const kids = n.content ?? [];
		const isBlockText =
			kids.length > 0 &&
			kids.every((k) => k.type === 'text' || k.type === 'mention' || k.type === 'hardBreak');
		if (n.type === 'paragraph' || n.type === 'heading' || n.type === 'codeBlock' || isBlockText) {
			const t = inline(n);
			if (t.trim()) lines.push(t);
			return;
		}
		kids.forEach(walk);
	};
	walk(doc);
	return { text: lines.join('\n'), paragraphs: lines.length };
}

export function docStats(doc: DocNode): DocStats {
	const { text, paragraphs } = docText(doc);
	const t = textStats(text);
	return { ...t, paragraphs, readingMinutes: readingMinutes(t.words) };
}

const nf = new Intl.NumberFormat('en');
/** "1,240 words · 6 min read" (or "1 word · < 1 min read"). */
export function formatStats(words: number): string {
	const w = `${nf.format(words)} ${words === 1 ? 'word' : 'words'}`;
	const m = readingMinutes(words);
	return words === 0 ? w : `${w} · ${m <= 1 && words < READING_WPM ? '< 1' : m} min read`;
}
