import { Extension, type Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { getPref } from '$lib/shared/localPrefs';
import { LINK_PREVIEW_PREF } from './links';

const HOVER_MS = 450;
const LEAVE_MS = 250;

/**
 * Only https pages, and never this app's own origin: the sandbox needs allow-same-origin for
 * ordinary sites to work, which would give a page from our origin access to the boards.
 */
export function canPreview(url: unknown, ownOrigin: string = location.origin): url is string {
	if (typeof url !== 'string') return false;
	try {
		const u = new URL(url);
		return u.protocol === 'https:' && u.origin !== ownOrigin;
	} catch {
		return false;
	}
}

/** Where each link with its preview turned on ends, in document order (one per link run). */
export function previewAnchors(doc: PMNode): { pos: number; url: string }[] {
	const out: { pos: number; url: string }[] = [];
	doc.descendants((node, pos) => {
		const link = node.marks.find((m) => m.type.name === 'link' && m.attrs.preview === true);
		if (!link || !canPreview(link.attrs.href)) return;
		const url = link.attrs.href as string;
		const end = pos + node.nodeSize;
		const last = out.at(-1);
		if (last?.url === url && last.pos === pos) last.pos = end;
		else out.push({ pos: end, url });
	});
	return out;
}

function pageFrame(url: string): HTMLIFrameElement {
	const frame = document.createElement('iframe');
	frame.src = url;
	frame.title = `Preview of ${url}`;
	frame.loading = 'lazy';
	frame.referrerPolicy = 'no-referrer';
	frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
	frame.className = 'min-h-0 w-full flex-1 border-0 bg-white';
	return frame;
}

function openLink(url: string): HTMLAnchorElement {
	const a = document.createElement('a');
	a.href = url;
	a.target = '_blank';
	a.rel = 'noopener noreferrer';
	a.textContent = 'Open in new tab';
	a.className = 'shrink-0 font-medium text-accent hover:underline';
	return a;
}

/** A frame with a footer: sites can refuse to be framed, and we can't detect it. */
function previewCard(url: string, className: string): HTMLElement {
	const card = document.createElement('span');
	card.className = `flex flex-col overflow-hidden rounded-lg border border-border bg-surface text-xs ${className}`;
	card.dataset.linkPreview = url;
	card.contentEditable = 'false';
	const footer = document.createElement('span');
	footer.className = 'flex items-center gap-2 px-2 py-1 text-muted';
	const note = document.createElement('span');
	note.className = 'min-w-0 flex-1 truncate';
	note.textContent = 'Blank? This site refuses previews.';
	footer.append(note, openLink(url));
	card.append(pageFrame(url), footer);
	return card;
}

function decorations(doc: PMNode): DecorationSet {
	return DecorationSet.create(
		doc,
		previewAnchors(doc).map(({ pos, url }) =>
			// The key keeps the frame (and the page in it) alive while typing elsewhere.
			Decoration.widget(pos, () => previewCard(url, 'my-2 h-64 w-full'), {
				side: 1,
				key: `link-preview:${url}`,
				ignoreSelection: true,
				stopEvent: () => true
			})
		)
	);
}

function hoverPreviews(view: EditorView) {
	let popup: HTMLElement | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const close = () => {
		popup?.remove();
		popup = null;
	};
	const closeSoon = () => {
		clearTimeout(timer);
		timer = setTimeout(close, LEAVE_MS);
	};
	function show(link: HTMLAnchorElement) {
		close();
		const card = previewCard(
			link.href,
			'fixed z-[80] h-80 w-[min(440px,calc(100vw-16px))] shadow-xl'
		);
		card.dataset.interactive = '';
		const r = link.getBoundingClientRect();
		const below = r.bottom + 328 < innerHeight;
		card.style.top = `${below ? r.bottom + 8 : Math.max(8, r.top - 328)}px`;
		card.style.left = `${Math.max(8, Math.min(r.left, innerWidth - 448))}px`;
		card.addEventListener('mouseenter', () => clearTimeout(timer));
		card.addEventListener('mouseleave', closeSoon);
		document.body.append(card);
		popup = card;
	}
	const linkAt = (e: Event) =>
		e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('a[href]') : null;
	const over = (e: Event) => {
		const link = linkAt(e);
		if (!link || !canPreview(link.href)) return;
		if (getPref<unknown>(LINK_PREVIEW_PREF, false) !== true) return;
		if (link.closest('[data-link-preview]')) return;
		clearTimeout(timer);
		timer = setTimeout(() => show(link), HOVER_MS);
	};
	const out = (e: Event) => {
		if (linkAt(e)) closeSoon();
	};
	view.dom.addEventListener('mouseover', over);
	view.dom.addEventListener('mouseout', out);
	return {
		destroy() {
			clearTimeout(timer);
			close();
			view.dom.removeEventListener('mouseover', over);
			view.dom.removeEventListener('mouseout', out);
		}
	};
}

/** Turns the page preview of the link at the selection on or off. */
export function toggleLinkPreview(editor: Editor): void {
	const on = editor.getAttributes('link').preview === true;
	editor
		.chain()
		.focus()
		.extendMarkRange('link')
		.updateAttributes('link', { preview: on ? null : true })
		.run();
}

/** Page previews of links: a stored per-link `preview` attribute, and the hover popup. */
export const LinkPreview = Extension.create({
	name: 'linkPreview',
	addGlobalAttributes() {
		return [
			{
				types: ['link'],
				attributes: {
					preview: {
						default: null,
						parseHTML: (el) => (el.hasAttribute('data-preview') ? true : null),
						renderHTML: (attrs) => (attrs.preview ? { 'data-preview': '' } : {})
					}
				}
			}
		];
	},
	addProseMirrorPlugins() {
		return [
			new Plugin<DecorationSet>({
				key: new PluginKey('linkPreview'),
				state: {
					init: (_, state) => decorations(state.doc),
					apply: (tr, old) => (tr.docChanged ? decorations(tr.doc) : old)
				},
				props: {
					decorations(state) {
						return this.getState(state);
					}
				},
				view: hoverPreviews
			})
		];
	}
});
