import type { DocNode } from '../doccards/markdown';
import { docToMarkdown } from '../doccards/markdown';
import type { Chapter } from './outline';

// Turning the outline's doc cards into one manuscript (pure). Writers (Markdown here, Word and
// print elsewhere) render the same structure.

export type Separator = 'stars' | 'blank' | 'none';

export interface CompileOptions {
	/** Frame titles as chapter headings. */
	chapterHeadings: boolean;
	/** "Chapter 1: …" numbering. */
	numberChapters: boolean;
	/** Card titles as scene headings. */
	sceneTitles: boolean;
	/** Between scenes of one chapter. */
	separator: Separator;
	titlePage: { title: string; author: string; date: string } | null;
	/** Chapters to include, by frame id ('' = cards outside frames). Missing = all. */
	include?: ReadonlySet<string>;
	/** Leave collapsed cards out. */
	skipCollapsed: boolean;
}

export const DEFAULT_COMPILE: CompileOptions = {
	chapterHeadings: true,
	numberChapters: false,
	sceneTitles: false,
	separator: 'stars',
	titlePage: null,
	skipCollapsed: false
};

export interface Scene {
	title: string;
	/** The card's blocks, its headings moved below the manuscript's own levels. */
	blocks: DocNode[];
}
export interface ManuscriptChapter {
	heading: string | null;
	scenes: Scene[];
}
export interface Manuscript {
	titlePage: CompileOptions['titlePage'];
	chapters: ManuscriptChapter[];
	separator: Separator;
}

/** Card headings sit under the chapter (H1) and scene (H2) headings: H1 → H3 and so on. */
function demote(nodes: DocNode[], by: number): DocNode[] {
	return nodes.map((n) =>
		n.type === 'heading'
			? { ...n, attrs: { ...n.attrs, level: Math.min(6, Number(n.attrs?.level ?? 1) + by) } }
			: n.content
				? { ...n, content: demote(n.content, by) }
				: n
	);
}

const isEmpty = (blocks: DocNode[]) =>
	blocks.every(
		(b) => !b.content?.length || b.content.every((c) => c.type === 'text' && !c.text?.trim())
	);

export function compile(
	chapters: readonly Chapter[],
	content: (cardId: string) => DocNode,
	opts: CompileOptions
): Manuscript {
	let n = 0;
	const out: ManuscriptChapter[] = [];
	for (const ch of chapters) {
		const key = ch.frame?.id ?? '';
		if (opts.include && !opts.include.has(key)) continue;
		const scenes = ch.cards
			.filter((c) => !(opts.skipCollapsed && c.collapsed))
			.map((c) => ({ title: c.title, blocks: demote(content(c.id).content ?? [], 2) }))
			.filter((s) => !isEmpty(s.blocks) || opts.sceneTitles);
		if (scenes.length === 0) continue;
		const title = ch.frame?.title.trim() || null;
		let heading: string | null = null;
		if (opts.chapterHeadings && ch.frame) {
			n++;
			// Frames already called "Chapter 3" aren't numbered again.
			const named = title !== null && /^chapter\s+\S+/i.test(title);
			heading =
				opts.numberChapters && !named
					? `Chapter ${n}${title ? `: ${title}` : ''}`
					: (title ?? `Chapter ${n}`);
		}
		out.push({
			heading,
			scenes: scenes.map((s) => (opts.sceneTitles ? s : { ...s, title: '' }))
		});
	}
	return { titlePage: opts.titlePage, chapters: out, separator: opts.separator };
}

export function manuscriptWords(m: Manuscript, words: (blocks: DocNode[]) => number): number {
	return m.chapters.reduce((n, c) => n + c.scenes.reduce((k, s) => k + words(s.blocks), 0), 0);
}

const SEPARATOR_MD: Record<Separator, string> = { stars: '\\* \\* \\*', blank: '&nbsp;', none: '' };

export function manuscriptToMarkdown(m: Manuscript, link?: (id: string) => string | null): string {
	const parts: string[] = [];
	if (m.titlePage) {
		const { title, author, date } = m.titlePage;
		parts.push(`# ${title}`, [author && `*${author}*`, date].filter(Boolean).join('  \n'));
	}
	for (const ch of m.chapters) {
		if (ch.heading) parts.push(`# ${ch.heading}`);
		ch.scenes.forEach((s, i) => {
			if (i > 0 && SEPARATOR_MD[m.separator]) parts.push(SEPARATOR_MD[m.separator]);
			if (s.title) parts.push(`## ${s.title}`);
			const body = docToMarkdown({ type: 'doc', content: s.blocks }, { link }).trim();
			if (body) parts.push(body);
		});
	}
	return `${parts.filter((p) => p.trim()).join('\n\n')}\n`;
}
