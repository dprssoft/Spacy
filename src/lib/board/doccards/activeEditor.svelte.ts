import type { Editor } from './editorFactory';

class ActiveDocEditor {
	current = $state.raw<Editor | null>(null);
}

/** The canvas doc card editor that is being edited, if any: the ribbon shows its formatting. */
export const activeDocEditor = new ActiveDocEditor();
