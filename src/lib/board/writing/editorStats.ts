import type { Node as PMNode } from '@tiptap/pm/model';
import type { Editor } from '../doccards/editorFactory';
import { countWords, readingMinutes, textStats, type DocStats, type TextStats } from './wordCount';

export interface LiveStats extends DocStats {
	/** Words in the selection (0 when it's collapsed). */
	selectionWords: number;
}

const DELAY_MS = 300;

type BlockStats = TextStats & { paragraphs: number };
// ProseMirror nodes are immutable and shared between editor states, so a block's counts are
// cached by identity: typing recounts only the block being edited.
const cache = new WeakMap<PMNode, BlockStats>();

const leafText = (n: PMNode) =>
	n.type.name === 'mention' ? String(n.attrs.label ?? '') : n.type.name === 'hardBreak' ? '\n' : '';

function blockStats(block: PMNode): BlockStats {
	let s = cache.get(block);
	if (s) return s;
	const lines: string[] = [];
	if (block.isTextblock) lines.push(block.textBetween(0, block.content.size, '\n', leafText));
	else
		block.descendants((n) => {
			if (!n.isTextblock) return true;
			lines.push(n.textBetween(0, n.content.size, '\n', leafText));
			return false;
		});
	const filled = lines.filter((l) => l.trim());
	s = { ...textStats(filled.join('\n')), paragraphs: filled.length };
	cache.set(block, s);
	return s;
}

export function editorDocStats(doc: PMNode): DocStats {
	const total = { words: 0, chars: 0, charsNoSpaces: 0, paragraphs: 0 };
	doc.forEach((block) => {
		const b = blockStats(block);
		total.words += b.words;
		total.chars += b.chars;
		total.charsNoSpaces += b.charsNoSpaces;
		total.paragraphs += b.paragraphs;
	});
	return { ...total, readingMinutes: readingMinutes(total.words) };
}

/**
 * Counts an editor's text after edits and selection changes, at most every 300 ms. Returns stop.
 */
export function watchEditorStats(editor: Editor, onStats: (s: LiveStats) => void): () => void {
	let timer: ReturnType<typeof setTimeout> | null = null;
	const run = () => {
		timer = null;
		if (editor.isDestroyed) return;
		const { from, to, empty } = editor.state.selection;
		onStats({
			...editorDocStats(editor.state.doc),
			selectionWords: empty ? 0 : countWords(editor.state.doc.textBetween(from, to, '\n', leafText))
		});
	};
	const schedule = () => {
		timer ??= setTimeout(run, DELAY_MS);
	};
	editor.on('update', schedule);
	editor.on('selectionUpdate', schedule);
	run();
	return () => {
		if (timer) clearTimeout(timer);
		editor.off('update', schedule);
		editor.off('selectionUpdate', schedule);
	};
}
