// The rich-text editor (TipTap) is the heaviest part of the board; it loads on first use.
type BoardEditorModule = typeof import('./boardEditor');

let promise: Promise<BoardEditorModule> | null = null;

export function loadBoardEditor(): Promise<BoardEditorModule> {
	promise ??= import('./boardEditor').catch((err: unknown) => {
		promise = null; // allow a retry (e.g. after a failed chunk load)
		throw err;
	});
	return promise;
}

export type { BoardEditorModule };
