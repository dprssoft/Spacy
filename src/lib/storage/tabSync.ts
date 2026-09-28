import * as Y from 'yjs';
import { REMOTE_TAB } from '$lib/model/origins';

type Message =
	| { type: 'update'; update: Uint8Array }
	// A tab announces its state vector; peers reply with what it's missing. `reply` marks the
	// answer from a peer, which gets the newcomer's missing updates in return (no further replies).
	| { type: 'hello'; sv: Uint8Array; reply: boolean };

/** Keeps the same board's Y.Doc in sync between browser tabs. Returns cleanup. */
export function createTabSync(doc: Y.Doc, channelName: string): () => void {
	if (typeof BroadcastChannel !== 'function') return () => {};
	const channel = new BroadcastChannel(channelName);
	const post = (msg: Message) => channel.postMessage(msg);

	const onUpdate = (update: Uint8Array, origin: unknown) => {
		if (origin !== REMOTE_TAB) post({ type: 'update', update });
	};

	const onMessage = (e: MessageEvent<Message>) => {
		const msg = e.data;
		if (msg.type === 'update') {
			Y.applyUpdate(doc, msg.update, REMOTE_TAB);
		} else if (msg.type === 'hello') {
			post({ type: 'update', update: Y.encodeStateAsUpdate(doc, msg.sv) });
			if (!msg.reply) post({ type: 'hello', sv: Y.encodeStateVector(doc), reply: true });
		}
	};

	doc.on('update', onUpdate);
	channel.addEventListener('message', onMessage);
	post({ type: 'hello', sv: Y.encodeStateVector(doc), reply: false });

	return () => {
		doc.off('update', onUpdate);
		channel.removeEventListener('message', onMessage);
		channel.close();
	};
}
