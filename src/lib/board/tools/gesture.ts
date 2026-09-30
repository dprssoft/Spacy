import type * as Y from 'yjs';

/**
 * Makes everything written between `begin()` and `end()` a single undo step, however long the
 * gesture takes (Yjs otherwise splits captures after `captureTimeout` ms of inactivity).
 */
export function undoGesture(undo: Y.UndoManager) {
	let saved: number | null = null;
	return {
		begin(): void {
			if (saved !== null) return;
			undo.stopCapturing();
			saved = undo.captureTimeout;
			undo.captureTimeout = Number.POSITIVE_INFINITY;
		},
		end(): void {
			if (saved === null) return;
			undo.captureTimeout = saved;
			saved = null;
			undo.stopCapturing();
		},
		get active(): boolean {
			return saved !== null;
		}
	};
}
