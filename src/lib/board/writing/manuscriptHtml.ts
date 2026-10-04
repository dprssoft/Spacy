import type { DocMark, DocNode } from '../doccards/markdown';
import type { Manuscript } from './compile';

// A manuscript as a printable HTML page (the browser's "Save as PDF" makes the PDF).

const esc = (s: string) =>
	s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function marked(text: string, marks: DocMark[] = []): string {
	let out = esc(text);
	const has = (t: string) => marks.some((m) => m.type === t);
	if (has('code')) out = `<code>${out}</code>`;
	if (has('strike')) out = `<s>${out}</s>`;
	if (has('underline')) out = `<u>${out}</u>`;
	if (has('italic')) out = `<em>${out}</em>`;
	if (has('bold')) out = `<strong>${out}</strong>`;
	const href = marks.find((m) => m.type === 'link')?.attrs?.href;
	if (typeof href === 'string' && /^(https?:|mailto:)/i.test(href))
		out = `<a href="${esc(href)}">${out}</a>`;
	return out;
}

function inline(nodes: DocNode[] = []): string {
	return nodes
		.map((n) =>
			n.type === 'text'
				? marked(n.text ?? '', n.marks)
				: n.type === 'mention'
					? marked(String(n.attrs?.label ?? ''), n.marks)
					: n.type === 'hardBreak'
						? '<br>'
						: ''
		)
		.join('');
}

function block(n: DocNode): string {
	const align = n.attrs?.align ? ` style="text-align:${esc(String(n.attrs.align))}"` : '';
	const kids = () => (n.content ?? []).map(block).join('');
	switch (n.type) {
		case 'paragraph':
			return `<p${align}>${inline(n.content)}</p>`;
		case 'heading': {
			const l = Math.min(6, Number(n.attrs?.level ?? 1));
			return `<h${l}${align}>${inline(n.content)}</h${l}>`;
		}
		case 'blockquote':
			return `<blockquote>${kids()}</blockquote>`;
		case 'codeBlock':
			return `<pre><code>${esc((n.content ?? []).map((c) => c.text ?? '').join(''))}</code></pre>`;
		case 'horizontalRule':
			return '<p class="sep">* * *</p>';
		case 'bulletList':
			return `<ul>${kids()}</ul>`;
		case 'orderedList':
			return `<ol>${kids()}</ol>`;
		case 'taskList':
			return `<ul class="tasks">${kids()}</ul>`;
		case 'listItem':
			return `<li>${kids()}</li>`;
		case 'taskItem':
			return `<li>${n.attrs?.checked ? '☑' : '☐'} ${kids()}</li>`;
		default:
			return kids();
	}
}

const CSS = `
@page { margin: 2.5cm; }
body { font: 12pt/1.6 Lora, Georgia, 'Times New Roman', serif; color: #111; max-width: 42em; margin: 2em auto; }
h1 { font-size: 20pt; margin: 0 0 1em; break-after: avoid; }
h2 { font-size: 15pt; margin: 1.6em 0 0.6em; break-after: avoid; }
h3, h4, h5, h6 { font-size: 12.5pt; break-after: avoid; }
.chapter { break-before: page; }
.chapter:first-of-type { break-before: auto; }
.title-page { break-after: page; text-align: center; padding-top: 30vh; }
.title-page h1 { font-size: 28pt; }
.sep { text-align: center; margin: 1.4em 0; }
blockquote { margin: 1em 2em; font-style: italic; }
pre { font: 10pt/1.4 Consolas, monospace; white-space: pre-wrap; }
ul.tasks { list-style: none; padding-left: 1em; }
p { margin: 0 0 0.8em; }
`;

export function manuscriptToHtml(m: Manuscript, docTitle: string): string {
	const parts: string[] = [];
	if (m.titlePage) {
		const { title, author, date } = m.titlePage;
		parts.push(
			`<section class="title-page"><h1>${esc(title)}</h1>${author ? `<p><em>${esc(author)}</em></p>` : ''}${date ? `<p>${esc(date)}</p>` : ''}</section>`
		);
	}
	for (const ch of m.chapters) {
		const scenes = ch.scenes
			.map((s, i) => {
				const sep =
					i > 0 && m.separator === 'stars'
						? '<p class="sep">* * *</p>'
						: i > 0 && m.separator === 'blank'
							? '<p>&nbsp;</p>'
							: '';
				return `${sep}${s.title ? `<h2>${esc(s.title)}</h2>` : ''}${s.blocks.map(block).join('')}`;
			})
			.join('');
		parts.push(
			`<section class="chapter">${ch.heading ? `<h1>${esc(ch.heading)}</h1>` : ''}${scenes}</section>`
		);
	}
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(docTitle)}</title><style>${CSS}</style></head><body>${parts.join('')}</body></html>`;
}
