import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';

/** Focus mode lives in the URL (`?doc=<cardId>`), so back/forward and deep links work. */
export const FOCUS_PARAM = 'doc';

export function focusedDocId(): string | null {
	return page.url.searchParams.get(FOCUS_PARAM);
}

export function openFocus(boardId: string, cardId: string): void {
	if (focusedDocId() === cardId) return;
	void goto(resolve(`/board/${boardId}?${FOCUS_PARAM}=${encodeURIComponent(cardId)}`), {
		noScroll: true,
		keepFocus: true,
		state: { focusPushed: true }
	});
}

/** Goes back if opening pushed the entry (so Forward reopens it), else just drops the parameter. */
export function closeFocus(boardId: string): void {
	if (!focusedDocId()) return;
	if (page.state.focusPushed) history.back();
	else
		void goto(resolve('/board/[id]', { id: boardId }), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
}
