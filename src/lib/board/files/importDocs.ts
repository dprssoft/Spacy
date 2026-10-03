// Text, Markdown and Word files dropped on the board become doc cards. Loaded on demand: it pulls
// in TipTap's schema (and the Markdown parser), which the board otherwise loads lazily too.
import { DOMParser as PMDOMParser } from '@tiptap/pm/model';
import { marked } from 'marked';
import { newElementBase } from '$lib/model/defaults';
import { getDocsMap } from '$lib/model/doc';
import { newId } from '$lib/model/ids';
import { createElements } from '$lib/model/ops';
import { LOCAL } from '$lib/model/origins';
import type { Point } from '$lib/model/types';
import { docSchema, setDocContent } from '$lib/templates/docContent';
import type { BoardContext } from '../context';
import type { DocNode } from '../doccards/markdown';
import { getDefaultStyle } from '../style/styleDefaults';
import { docxToHtml } from './docx';
import { docFileKind, MAX_DOC_BYTES, type DocFileKind } from './fileKinds';

const CARD = { w: 480, h: 560 };
const CASCADE = 24;

const escapeHtml = (s: string) =>
	s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Plain text: blank lines separate paragraphs, single line breaks stay line breaks. */
export function textToHtml(text: string): string {
	return text
		.replace(/\r\n?/g, '\n')
		.split(/\n\s*\n/)
		.filter((p) => p.trim())
		.map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
		.join('');
}

export function markdownToHtml(md: string): string {
	return marked.parse(md, { async: false, gfm: true });
}

/**
 * HTML → doc card content. Only what the schema knows is kept. GitHub-style task lists become
 * checklists, and links other than http(s)/mailto are unlinked.
 */
export function htmlToDoc(html: string): DocNode {
	const dom = new DOMParser().parseFromString(html, 'text/html');
	for (const a of dom.querySelectorAll('a')) {
		if (!/^(https?:|mailto:)/i.test(a.getAttribute('href') ?? '')) a.replaceWith(...a.childNodes);
	}
	for (const box of dom.querySelectorAll('li input[type=checkbox]')) {
		const li = box.closest('li')!;
		li.dataset.type = 'taskItem';
		li.dataset.checked = String((box as HTMLInputElement).checked);
		box.remove();
	}
	for (const list of dom.querySelectorAll('ul')) {
		const items = [...list.children];
		if (items.length && items.every((li) => (li as HTMLElement).dataset.type === 'taskItem'))
			list.dataset.type = 'taskList';
	}
	return PMDOMParser.fromSchema(docSchema()).parse(dom.body).toJSON() as DocNode;
}

async function toHtml(file: File, kind: DocFileKind): Promise<string> {
	if (kind === 'docx') return docxToHtml(await file.arrayBuffer());
	const text = await file.text();
	return kind === 'markdown' ? markdownToHtml(text) : textToHtml(text);
}

const titleOf = (name: string) => name.replace(/\.[^.]+$/, '').trim() || 'Untitled';

/**
 * Adds a doc card per file, centered on `at` (several cascade). Each card is one undo step.
 * Returns the new ids; files that can't be read are reported through `onError`.
 */
export async function importDocFiles(
	ctx: BoardContext,
	files: File[],
	at: Point,
	onError: (file: File, message: string) => void
): Promise<string[]> {
	const ids: string[] = [];
	for (const file of files) {
		const kind = docFileKind(file);
		if (!kind) continue;
		if (file.size > MAX_DOC_BYTES) {
			onError(file, 'file is larger than 10 MB');
			continue;
		}
		let content: DocNode;
		try {
			content = htmlToDoc(await toHtml(file, kind));
		} catch {
			onError(
				file,
				kind === 'docx' ? 'could not read the Word document' : 'could not read the file'
			);
			continue;
		}
		const id = newId();
		const offset = ids.length * CASCADE;
		const pos = { x: at.x - CARD.w / 2 + offset, y: at.y - CARD.h / 2 + offset };
		ctx.undo.stopCapturing();
		// One transaction, so creating the card and filling it is a single undo step.
		ctx.doc.transact(() => {
			createElements(ctx.doc, [
				{
					...newElementBase('doccard', id, pos, getDefaultStyle('doccard')),
					...pos,
					...CARD,
					type: 'doccard',
					title: titleOf(file.name),
					collapsed: false,
					expandedH: CARD.h
				}
			]);
			setDocContent(getDocsMap(ctx.doc).get(id)!, content);
		}, LOCAL);
		ctx.undo.stopCapturing();
		ids.push(id);
	}
	return ids;
}
