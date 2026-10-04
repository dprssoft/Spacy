import * as Y from 'yjs';
import type { Element } from '$lib/model/types';

// Find across the board's text (pure; Yjs only): canvas fields and doc card text. Doc text is
// searched per Yjs text node, so a replacement keeps its formatting and never crosses a mention.

export interface SearchOptions {
	matchCase: boolean;
	wholeWord: boolean;
	regex: boolean;
}

export interface Match {
	from: number;
	to: number;
	text: string;
}

export type Matcher = {
	find(text: string): Match[];
	replace(match: string, replacement: string): string;
};

const MAX_MATCHES = 2000;

/**
 * Patterns with a quantified group that is itself quantified, like `(a+)+` or `(.*)*`, can take
 * exponential time on some inputs (no way to interrupt a running RegExp): they're refused.
 */
export function isRiskyRegex(pattern: string): boolean {
	return /\((?:[^()\\]|\\.)*[+*}][^()]*\)\s*[+*{]/.test(pattern);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function makeMatcher(
	query: string,
	opts: SearchOptions
): Matcher | { error: string } | null {
	if (!query) return null;
	if (opts.regex && isRiskyRegex(query)) return { error: 'This pattern could be very slow' };
	let source = opts.regex ? query : escapeRe(query);
	if (opts.wholeWord) source = `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`;
	let re: RegExp;
	try {
		re = new RegExp(source, `gu${opts.matchCase ? '' : 'i'}`);
	} catch {
		return { error: 'Not a valid regular expression' };
	}
	const single = new RegExp(source, `u${opts.matchCase ? '' : 'i'}`);
	return {
		find(text) {
			const out: Match[] = [];
			re.lastIndex = 0;
			let m: RegExpExecArray | null;
			while ((m = re.exec(text)) && out.length < MAX_MATCHES) {
				if (m[0] === '') {
					re.lastIndex++;
					continue;
				}
				out.push({ from: m.index, to: m.index + m[0].length, text: m[0] });
			}
			return out;
		},
		// Regex replacements understand $1, $& …; plain ones are literal.
		replace: (match, replacement) => (opts.regex ? match.replace(single, replacement) : replacement)
	};
}

export type CanvasField = 'text' | 'title' | 'label';

export function canvasFields(el: Element): { field: CanvasField; value: string }[] {
	switch (el.type) {
		case 'shape':
		case 'sticky':
		case 'text':
			return [{ field: 'text', value: el.text }];
		case 'frame':
		case 'doccard':
		case 'media':
			return [{ field: 'title', value: el.title }];
		case 'connector':
			return el.label.text ? [{ field: 'label', value: el.label.text }] : [];
		default:
			return [];
	}
}

/** The Yjs text nodes of a doc card, in document order. */
export function docTexts(frag: Y.XmlFragment): Y.XmlText[] {
	const out: Y.XmlText[] = [];
	const walk = (node: Y.XmlFragment | Y.XmlElement) => {
		for (const child of node.toArray()) {
			if (child instanceof Y.XmlText) out.push(child);
			else if (child instanceof Y.XmlElement) walk(child);
		}
	};
	walk(frag);
	return out;
}

/** A text node's plain string (formatting attributes dropped). */
export const plainText = (t: Y.XmlText) =>
	(t.toDelta() as { insert: unknown }[])
		.map((d) => (typeof d.insert === 'string' ? d.insert : ''))
		.join('');

/** Text around a match for the results list. */
export function context(text: string, from: number, to: number, around = 32) {
	const start = Math.max(0, from - around);
	const end = Math.min(text.length, to + around);
	return {
		before: `${start > 0 ? '…' : ''}${text.slice(start, from)}`,
		match: text.slice(from, to),
		after: `${text.slice(to, end)}${end < text.length ? '…' : ''}`
	};
}
