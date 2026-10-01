// The only module that imports TipTap (with the later doccard modules), so it can be lazy-loaded.
import { Editor, type Extensions } from '@tiptap/core';
import Collaboration from '@tiptap/extension-collaboration';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import StarterKit from '@tiptap/starter-kit';
import type * as Y from 'yjs';

const SAFE_PROTOCOL = /^(https?:|mailto:)/i;

/** Allows only http(s) and mailto links (relative or `javascript:` URLs are refused). */
export function isSafeLink(url: string): boolean {
	return SAFE_PROTOCOL.test(url.trim());
}

export function docExtensions(
	fragment: Y.XmlFragment,
	opts: { placeholder?: string } = {}
): Extensions {
	return [
		StarterKit.configure({
			heading: { levels: [1, 2, 3] },
			// Collaboration brings its own (Yjs) undo; ProseMirror history would fight it.
			undoRedo: false,
			underline: false,
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
		Placeholder.configure({ placeholder: opts.placeholder ?? 'Write something…' }),
		Collaboration.configure({ fragment })
	];
}

export interface DocEditorOptions {
	element: HTMLElement;
	fragment: Y.XmlFragment;
	editable: boolean;
	placeholder?: string;
	onFocus?(): void;
	onBlur?(): void;
}

export function createDocEditor(opts: DocEditorOptions): Editor {
	return new Editor({
		element: opts.element,
		editable: opts.editable,
		extensions: docExtensions(opts.fragment, { placeholder: opts.placeholder }),
		onFocus: () => opts.onFocus?.(),
		onBlur: () => opts.onBlur?.()
	});
}

export type { Editor };
