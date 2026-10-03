// Deterministic Markdown (CommonMark + GFM task lists) for the doc card schema. Pure: works on the
// editor's JSON, no TipTap import.

export interface DocMark {
	type: string;
	attrs?: Record<string, unknown>;
}

export interface DocNode {
	type?: string;
	attrs?: Record<string, unknown>;
	content?: DocNode[];
	text?: string;
	marks?: DocMark[];
}

// The current conversion's link lookup for mentions (conversion is synchronous).
let mentionLink: ((id: string) => string | null) | null = null;

/**
 * `link` gives a URL for a mentioned element (a media element's link); such mentions become
 * `[label](url)` instead of `@label`.
 */
export function docToMarkdown(
	doc: DocNode,
	opts: { title?: string; link?: (id: string) => string | null } = {}
): string {
	const parts: string[] = [];
	const title = opts.title?.trim();
	if (title) parts.push(`# ${escapeInline(title)}`);
	mentionLink = opts.link ?? null;
	try {
		const body = blocks(doc.content ?? []);
		if (body) parts.push(body);
	} finally {
		mentionLink = null;
	}
	return parts.length ? `${parts.join('\n\n')}\n` : '';
}

// --- Blocks --------------------------------------------------------------------------------------

function blocks(nodes: DocNode[]): string {
	return nodes
		.map(block)
		.filter((s): s is string => s !== null)
		.join('\n\n');
}

function block(node: DocNode): string | null {
	switch (node.type) {
		case 'paragraph': {
			const text = inline(node.content ?? []);
			return text ? escapeLineStarts(text) : null;
		}
		case 'heading': {
			const level = Math.min(3, Math.max(1, Number(node.attrs?.level) || 1));
			return `${'#'.repeat(level)} ${inline(node.content ?? [])}`.trimEnd();
		}
		case 'bulletList':
			return list(node, () => '- ', 2);
		case 'orderedList': {
			const start = Number(node.attrs?.start ?? 1) || 1;
			return list(node, (i) => `${start + i}. `);
		}
		case 'taskList':
			return list(node, (_, item) => (item.attrs?.checked ? '- [x] ' : '- [ ] '), 2);
		case 'blockquote': {
			const inner = blocks(node.content ?? []);
			return inner
				? inner
						.split('\n')
						.map((l) => (l ? `> ${l}` : '>'))
						.join('\n')
				: null;
		}
		case 'codeBlock': {
			const text = (node.content ?? []).map((c) => c.text ?? '').join('');
			const runs = text.match(/`+/g) ?? [];
			const fence = '`'.repeat(Math.max(3, ...runs.map((r) => r.length + 1)));
			const lang = typeof node.attrs?.language === 'string' ? node.attrs.language : '';
			return `${fence}${lang}\n${text}\n${fence}`;
		}
		case 'horizontalRule':
			return '---';
		default:
			return node.content ? blocks(node.content) || null : null;
	}
}

/**
 * A list: each item's first block follows the marker, the rest is indented under it. Nested lists
 * stay tight; other blocks inside an item are separated by a blank line. `indent` defaults to the
 * marker width, which CommonMark requires for continuation lines (3 for `1. `).
 */
function list(
	node: DocNode,
	marker: (i: number, item: DocNode) => string,
	indent?: number
): string | null {
	const items = (node.content ?? []).map((item, i) => {
		const m = marker(i, item);
		const pad = ' '.repeat(indent ?? m.length);
		let body = '';
		for (const child of item.content ?? []) {
			const md = block(child);
			if (md === null) continue;
			const isList = /List$/.test(child.type ?? '');
			body = body ? `${body}${isList ? '\n' : '\n\n'}${md}` : md;
		}
		const lines = body.split('\n');
		return (
			m +
			lines
				.map((l, j) => (j === 0 ? l : l ? pad + l : ''))
				.join('\n')
				.trimEnd()
		).trimEnd();
	});
	return items.length ? items.join('\n') : null;
}

// --- Inline --------------------------------------------------------------------------------------

const MARK_ORDER = ['link', 'bold', 'italic', 'strike', 'code'] as const;
const DELIMS: Record<string, string> = { bold: '**', italic: '_', strike: '~~' };

const markKey = (marks: DocMark[] | undefined) =>
	JSON.stringify(
		[...(marks ?? [])]
			.filter((m) => (MARK_ORDER as readonly string[]).includes(m.type))
			.sort((a, b) => a.type.localeCompare(b.type))
	);

function inline(nodes: DocNode[]): string {
	// Merge adjacent text nodes with identical marks.
	const merged: DocNode[] = [];
	for (const n of nodes) {
		const prev = merged.at(-1);
		if (n.type === 'text' && prev?.type === 'text' && markKey(prev.marks) === markKey(n.marks))
			merged[merged.length - 1] = { ...prev, text: (prev.text ?? '') + (n.text ?? '') };
		else merged.push(n);
	}
	return merged.map(inlineNode).join('');
}

/** A URL usable as a `[text](url)` target: spaces and parentheses percent-encoded. */
const linkTarget = (url: string) => url.replace(/[()\s]/g, (c) => encodeURIComponent(c));

function inlineNode(node: DocNode): string {
	if (node.type === 'hardBreak') return '  \n';
	if (node.type === 'mention') {
		const label = node.attrs?.label ?? node.attrs?.id ?? '';
		const url = mentionLink?.(String(node.attrs?.id ?? ''));
		if (url) return `[${escapeInline(String(label))}](${linkTarget(url)})`;
		return `@${escapeInline(String(label))}`;
	}
	if (node.type !== 'text') return '';
	return withMarks(node.text ?? '', node.marks ?? []);
}

function withMarks(text: string, marks: DocMark[]): string {
	const has = (t: string) => marks.find((m) => m.type === t);
	// Delimiters must hug the text: keep surrounding whitespace outside them.
	const [, lead = '', core = '', trail = ''] = /^(\s*)([\s\S]*?)(\s*)$/.exec(text) ?? [];
	if (!core) return text && !has('code') ? escapeInline(text) : text;

	let out = has('code') ? codeSpan(core) : escapeInline(core);
	for (const type of ['strike', 'italic', 'bold'] as const) {
		if (has(type)) out = `${DELIMS[type]}${out}${DELIMS[type]}`;
	}
	const link = has('link');
	if (link && typeof link.attrs?.href === 'string')
		out = `[${out}](${linkTarget(link.attrs.href)})`;
	return lead + out + trail;
}

function codeSpan(text: string): string {
	const runs = text.match(/`+/g) ?? [];
	const ticks = '`'.repeat(Math.max(0, ...runs.map((r) => r.length)) + 1);
	const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
	return `${ticks}${pad}${text}${pad}${ticks}`;
}

/** Characters that start emphasis, code or links anywhere in a line. */
function escapeInline(text: string): string {
	return text.replace(/[\\*_`[\]]/g, '\\$&');
}

/** Line starts that would turn text into a heading, quote or list item. */
function escapeLineStarts(text: string): string {
	return text
		.split('\n')
		.map((line) =>
			line
				.replace(/^(\s*)([#>])/, '$1\\$2')
				.replace(/^(\s*)([-+])(\s|$)/, '$1\\$2$3')
				.replace(/^(\s*)(\d+)([.)])(\s|$)/, '$1$2\\$3$4')
		)
		.join('\n');
}
