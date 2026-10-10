// In-memory Trystero-like rooms for unit tests: every room joined to one `FakeNetwork` sees the
// others as peers; actions deliver asynchronously, binary arrives as an ArrayBuffer like Trystero.
// Not imported by app code.
import type { PeerChannel, PeerRoom } from './peerSync';

type Handler = (data: unknown, ctx: { peerId: string; metadata?: unknown }) => void;

export class FakeNetwork {
	private readonly rooms = new Map<string, FakeRoom>();
	private next = 1;

	join(): FakeRoom {
		const room = new FakeRoom(`p${this.next++}`, this);
		for (const other of this.rooms.values()) {
			queueMicrotask(() => {
				other.onPeerJoin?.(room.id);
				room.onPeerJoin?.(other.id);
			});
		}
		this.rooms.set(room.id, room);
		return room;
	}

	leave(room: FakeRoom): void {
		this.rooms.delete(room.id);
		for (const other of this.rooms.values()) queueMicrotask(() => other.onPeerLeave?.(room.id));
	}

	peersOf(id: string): string[] {
		return [...this.rooms.keys()].filter((k) => k !== id);
	}

	deliver(
		from: string,
		to: string | string[] | undefined,
		action: string,
		data: unknown,
		metadata?: unknown
	) {
		const targets = to === undefined ? this.peersOf(from) : Array.isArray(to) ? to : [to];
		const payload =
			data instanceof Uint8Array
				? data.slice().buffer
				: data instanceof ArrayBuffer
					? data.slice(0)
					: data;
		for (const t of targets) {
			queueMicrotask(() => this.rooms.get(t)?.receive(action, payload, { peerId: from, metadata }));
		}
	}
}

export class FakeRoom implements PeerRoom {
	onPeerJoin: ((peerId: string) => void) | null = null;
	onPeerLeave: ((peerId: string) => void) | null = null;
	private readonly handlers = new Map<string, { onMessage: Handler | null }>();

	constructor(
		readonly id: string,
		private readonly net: FakeNetwork
	) {}

	makeAction<T>(namespace: string): PeerChannel<T> {
		const channel = {
			onMessage: null as PeerChannel<T>['onMessage'],
			send: async (
				data: T,
				options?: { target?: string | string[]; metadata?: Record<string, unknown> }
			) => this.net.deliver(this.id, options?.target, namespace, data, options?.metadata)
		};
		this.handlers.set(namespace, channel as unknown as { onMessage: Handler | null });
		return channel;
	}

	receive(action: string, data: unknown, ctx: { peerId: string; metadata?: unknown }): void {
		this.handlers.get(action)?.onMessage?.(data, ctx);
	}

	getPeers(): Record<string, unknown> {
		return Object.fromEntries(this.net.peersOf(this.id).map((p) => [p, {}]));
	}

	async leave(): Promise<void> {
		this.net.leave(this);
	}
}
