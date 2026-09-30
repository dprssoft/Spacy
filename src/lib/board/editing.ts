import { deleteElements } from '$lib/model/ops';
import type { BoardContext } from './context';

/** Starts and ends in-place text editing (the editing id itself lives in SelectionState). */
export class TextEditing {
	readonly #ctx: BoardContext;
	/** A just-created element that should vanish if left empty, and the undo depth after creating it. */
	#discard: { id: string; undoDepth: number } | null = null;

	constructor(ctx: BoardContext) {
		this.#ctx = ctx;
	}

	get id(): string | null {
		return this.#ctx.selection.editingId;
	}

	start(id: string, opts: { discardIfEmpty?: boolean } = {}): void {
		const { selection, undo } = this.#ctx;
		if (selection.editingId && selection.editingId !== id) this.end();
		selection.set([id]);
		undo.stopCapturing();
		this.#discard = opts.discardIfEmpty ? { id, undoDepth: undo.undoStack.length } : null;
		selection.editingId = id;
	}

	/** Leaves editing mode. Call after the editor has flushed its last write. */
	end(): void {
		const { selection, undo, store, doc } = this.#ctx;
		const id = selection.editingId;
		if (!id) return;
		selection.editingId = null;
		undo.stopCapturing();

		const discard = this.#discard;
		this.#discard = null;
		const el = store.get(id);
		if (!discard || discard.id !== id || !el || !('text' in el) || el.text.trim() !== '') return;

		selection.set([]);
		if (undo.undoStack.length === discard.undoDepth) {
			// Nothing else happened since creating it: undo the creation so no empty step remains.
			undo.undo();
			undo.clear(false, true);
		} else {
			deleteElements(doc, [id]);
		}
	}
}
