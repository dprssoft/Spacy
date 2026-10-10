// Spacy live sharing relay: y-webrtc's signaling protocol (subscribe / unsubscribe / publish /
// ping) on Cloudflare Workers. Browsers only use it to find each other; board data goes directly
// between them, and signaling messages are encrypted with the share key, so the relay stores and
// can read nothing. One Durable Object holds every connection; WebSocket hibernation keeps idle
// connections free.
import { DurableObject } from 'cloudflare:workers';

const MAX_MESSAGE_BYTES = 64 * 1024;
const MAX_TOPICS = 32;

export default {
	/** @param {Request} request @param {{ RELAY: DurableObjectNamespace }} env */
	async fetch(request, env) {
		if (request.headers.get('Upgrade') !== 'websocket') {
			return new Response('Spacy live sharing relay', { status: 200 });
		}
		return env.RELAY.get(env.RELAY.idFromName('relay')).fetch(request);
	}
};

export class Relay extends DurableObject {
	/** @param {DurableObjectState} ctx @param {unknown} env */
	constructor(ctx, env) {
		super(ctx, env);
		// Answered by the runtime without waking the object.
		ctx.setWebSocketAutoResponse(
			new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}')
		);
	}

	async fetch() {
		const [client, server] = Object.values(new WebSocketPair());
		this.ctx.acceptWebSocket(server);
		server.serializeAttachment({ topics: [] });
		return new Response(null, { status: 101, webSocket: client });
	}

	/** @param {WebSocket} ws */
	topicsOf(ws) {
		const a = ws.deserializeAttachment();
		return Array.isArray(a?.topics) ? a.topics : [];
	}

	/** @param {WebSocket} ws @param {string | ArrayBuffer} raw */
	async webSocketMessage(ws, raw) {
		if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_BYTES) return;
		let msg;
		try {
			msg = JSON.parse(raw);
		} catch {
			return;
		}
		if (!msg || typeof msg.type !== 'string') return;
		const mine = this.topicsOf(ws);
		const topics = Array.isArray(msg.topics) ? msg.topics.filter((t) => typeof t === 'string') : [];
		switch (msg.type) {
			case 'subscribe': {
				const next = [...new Set([...mine, ...topics])].slice(0, MAX_TOPICS);
				ws.serializeAttachment({ topics: next });
				break;
			}
			case 'unsubscribe':
				ws.serializeAttachment({ topics: mine.filter((t) => !topics.includes(t)) });
				break;
			case 'publish': {
				if (typeof msg.topic !== 'string') return;
				const receivers = this.ctx
					.getWebSockets()
					.filter((other) => this.topicsOf(other).includes(msg.topic));
				const out = JSON.stringify({ ...msg, clients: receivers.length });
				for (const r of receivers) {
					try {
						r.send(out);
					} catch {
						// Closed meanwhile; the runtime drops it.
					}
				}
				break;
			}
			case 'ping':
				ws.send('{"type":"pong"}');
		}
	}

	/** @param {WebSocket} ws */
	async webSocketClose(ws) {
		ws.close();
	}
}
