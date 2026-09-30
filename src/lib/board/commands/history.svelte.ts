import type * as Y from 'yjs';

/** Reactive can-undo/can-redo flags for the top bar, mirrored from the Yjs UndoManager. */
export class HistoryState {
	canUndo = $state(false);
	canRedo = $state(false);
	readonly #undo: Y.UndoManager;
	readonly #sync = () => {
		this.canUndo = this.#undo.canUndo();
		this.canRedo = this.#undo.canRedo();
	};

	constructor(undo: Y.UndoManager) {
		this.#undo = undo;
		this.#sync();
		undo.on('stack-item-added', this.#sync);
		undo.on('stack-item-popped', this.#sync);
		undo.on('stack-cleared', this.#sync);
	}

	undo(): void {
		this.#undo.undo();
		this.#sync();
	}

	redo(): void {
		this.#undo.redo();
		this.#sync();
	}

	destroy(): void {
		this.#undo.off('stack-item-added', this.#sync);
		this.#undo.off('stack-item-popped', this.#sync);
		this.#undo.off('stack-cleared', this.#sync);
	}
}
