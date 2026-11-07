// The only module that imports TipTap (with the later doccard modules), so it can be lazy-loaded.
import { Editor, type Extensions } from '@tiptap/core';
import { BubbleMenu } from '@tiptap/extension-bubble-menu';
import Collaboration from '@tiptap/extension-collaboration';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import StarterKit from '@tiptap/starter-kit';
import type * as Y from 'yjs';
import { formatExtensions } from './formatting';
import { isSafeLink } from './links';
import { LinkPreview } from './linkPreview';

export { isSafeLink };

export interface DocExtensionOptions {
	placeholder?: string;
	/** Root element of the formatting bubble menu (shown on a non-empty selection). */
	bubbleMenu?: HTMLElement;
	/** Where the bubble menu is attached (default: document.body). */
	bubbleMenuParent?: HTMLElement;
	/** More extensions (slash commands, mentions). */
	extra?: Extensions;
}

export function docExtensions(fragment: Y.XmlFragment, opts: DocExtensionOptions = {}): Extensions {
	const bubble = opts.bubbleMenu
		? [
				BubbleMenu.configure({
					element: opts.bubbleMenu,
					appendTo: () => opts.bubbleMenuParent ?? document.body,
					options: {
						strategy: 'fixed',
						placement: 'top',
						offset: 8,
						flip: true,
						shift: { padding: 8 }
					}
				})
			]
		: [];
	return [
		StarterKit.configure({
			heading: { levels: [1, 2, 3] },
			// Collaboration brings its own (Yjs) undo; ProseMirror history would fight it.
			undoRedo: false,
			link: {
				openOnClick: false,
				autolink: true,
				defaultProtocol: 'https',
				isAllowedUri: (url) => isSafeLink(url),
				shouldAutoLink: (url) => isSafeLink(url) || !/^[a-z][a-z0-9+.-]*:/i.test(url)
			}
		}),
		TaskList,
		TaskItem.configure({ nested: true }),
		...formatExtensions(),
		LinkPreview,
		Placeholder.configure({ placeholder: opts.placeholder ?? 'Write something…' }),
		Collaboration.configure({ fragment }),
		...bubble,
		...(opts.extra ?? [])
	];
}

export interface DocEditorOptions extends DocExtensionOptions {
	element: HTMLElement;
	fragment: Y.XmlFragment;
	editable: boolean;
	/** Accessible name of the text box. */
	label?: string;
	onFocus?(): void;
	onBlur?(): void;
}

export function createDocEditor(opts: DocEditorOptions): Editor {
	return new Editor({
		element: opts.element,
		editable: opts.editable,
		// The editor is a multi-line text box: give it a name for screen readers.
		editorProps: {
			attributes: { 'aria-label': opts.label ?? 'Doc card text', 'aria-multiline': 'true' }
		},
		extensions: docExtensions(opts.fragment, opts),
		onFocus: () => opts.onFocus?.(),
		onBlur: () => opts.onBlur?.()
	});
}

export type { Editor };
