// Reads and applies doc card formatting on an editor. Types only: importing this doesn't load TipTap.
import type { CommandProps } from '@tiptap/core';
import type { Editor } from './editorFactory';
import {
	ALIGNS,
	FORMAT_MARKS,
	isChoice,
	type Align,
	type BlockStyle,
	type FormatMark
} from './formatOptions';

/** The selection's color, font… id, or null for the default. */
export function choiceOf(editor: Editor, mark: FormatMark): string | null {
	const value: unknown = editor.getAttributes(mark)[FORMAT_MARKS[mark].attr];
	return isChoice(mark, value) ? value : null;
}

/** Applies a color, font… to the selection (or to what is typed next); null restores the default. */
export function setChoice(editor: Editor, mark: FormatMark, value: string | null): void {
	const chain = editor.chain().focus();
	if (value === null) chain.unsetMark(mark).run();
	else if (isChoice(mark, value)) chain.setMark(mark, { [FORMAT_MARKS[mark].attr]: value }).run();
}

export function alignOf(editor: Editor): Align {
	const value: unknown =
		editor.getAttributes('heading').align ?? editor.getAttributes('paragraph').align;
	return (ALIGNS as readonly unknown[]).includes(value) ? (value as Align) : 'left';
}

export function setAlign(editor: Editor, align: Align): void {
	const value = align === 'left' ? null : align;
	editor
		.chain()
		.focus()
		.updateAttributes('paragraph', { align: value })
		.updateAttributes('heading', { align: value })
		.run();
}

/** The style of the block where the selection starts. */
export function blockStyleOf(editor: Editor): BlockStyle {
	const { selection, doc } = editor.state;
	// A selection of everything starts before the first block.
	const $pos =
		selection.$from.depth === 0
			? doc.resolve(Math.min(selection.from + 1, doc.content.size))
			: selection.$from;
	for (let d = $pos.depth; d > 0; d--) if ($pos.node(d).type.name === 'blockquote') return 'quote';
	const block = $pos.parent;
	if (block.type.name === 'codeBlock') return 'code';
	if (block.type.name === 'heading') {
		const level: unknown = block.attrs.level;
		if (level === 1 || level === 2 || level === 3) return `h${level}`;
	}
	return 'p';
}

/**
 * Turns the selected text blocks into paragraphs or headings, each keeping its alignment (the
 * stock commands drop it when the selection spans several blocks).
 */
function toTextBlock(name: 'paragraph' | 'heading', attrs: Record<string, unknown> = {}) {
	return ({ tr, state }: Pick<CommandProps, 'tr' | 'state'>): boolean => {
		const type = state.schema.nodes[name];
		if (!type) return false;
		const { from, to, empty } = state.selection;
		tr.doc.nodesBetween(from, to, (node, pos) => {
			if (!node.isTextblock) return true;
			// Empty lines swept up by a selection stay as they are (the editor keeps one at the end).
			if (!empty && node.content.size === 0) return false;
			const $pos = tr.doc.resolve(pos);
			// E.g. a list item must start with a paragraph: leave what can't change.
			if ($pos.parent.canReplaceWith($pos.index(), $pos.index() + 1, type)) {
				const align: unknown = node.attrs.align ?? null;
				tr.setNodeMarkup(pos, type, { ...attrs, align });
			}
			return false;
		});
		return true;
	};
}

export function setBlockStyle(editor: Editor, style: BlockStyle): void {
	const current = blockStyleOf(editor);
	// Other styles are applied again: the selection may span blocks of several styles.
	if (current === 'quote' && style === 'quote') return;
	const chain = editor.chain().focus();
	// A quote wraps other blocks: leave it before turning the text into something else.
	if (current === 'quote') chain.lift('blockquote');
	switch (style) {
		case 'p':
			chain.command(toTextBlock('paragraph')).run();
			break;
		case 'quote':
			chain.command(toTextBlock('paragraph')).setBlockquote().run();
			break;
		case 'code':
			chain.setCodeBlock().run();
			break;
		default:
			chain.command(toTextBlock('heading', { level: Number(style[1]) })).run();
	}
}

/** Removes character formatting and alignment from the selection; block types and lists stay. */
export function clearFormatting(editor: Editor): void {
	editor
		.chain()
		.focus()
		.unsetAllMarks()
		.updateAttributes('paragraph', { align: null })
		.updateAttributes('heading', { align: null })
		.run();
}
