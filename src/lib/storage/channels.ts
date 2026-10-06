// "Board list changed" notifications for the start page, across tabs and within this tab.

type Message = { type: 'boards-changed' };

const EVENT = 'boards-changed';
const local = new EventTarget();
// One channel instance per tab: a BroadcastChannel never receives its own messages, and the
// local EventTarget covers this tab, so every listener fires exactly once per change.
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('spacy-meta') : null;

channel?.addEventListener('message', (e: MessageEvent<Message>) => {
	if (e.data?.type === EVENT) local.dispatchEvent(new Event(EVENT));
});

export function notifyBoardsChanged(): void {
	local.dispatchEvent(new Event(EVENT));
	channel?.postMessage({ type: EVENT } satisfies Message);
}

let pending: ReturnType<typeof setTimeout> | null = null;

/** Coalesces frequent background changes (edits, thumbnails, viewport) to one notice per second. */
export function notifyBoardsChangedSoon(): void {
	pending ??= setTimeout(() => {
		pending = null;
		notifyBoardsChanged();
	}, 1000);
}

export function onBoardsChanged(cb: () => void): () => void {
	local.addEventListener(EVENT, cb);
	return () => local.removeEventListener(EVENT, cb);
}
