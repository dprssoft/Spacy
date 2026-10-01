import type { Editor } from './editorFactory';

// Live editors per doc card (the canvas card and, while open, focus mode). Readers use any of them.
const editors = new Map<string, Set<Editor>>();

export function registerEditor(cardId: string, editor: Editor): () => void {
	let set = editors.get(cardId);
	if (!set) editors.set(cardId, (set = new Set()));
	set.add(editor);
	return () => {
		set.delete(editor);
		if (set.size === 0 && editors.get(cardId) === set) editors.delete(cardId);
	};
}

export function liveEditor(cardId: string): Editor | null {
	for (const e of editors.get(cardId) ?? []) if (!e.isDestroyed) return e;
	return null;
}
