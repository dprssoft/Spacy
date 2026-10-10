// Keeps a Y.Doc and its awareness in sync with every peer in a room (Trystero, step 52). Uses
// y-protocols' sync messages: a newcomer gets a state vector exchange, then every update is sent
// to everyone. Peer messages apply with this object as the origin (not LOCAL: never undone here).
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import {
	Awareness,
	applyAwarenessUpdate,
	encodeAwarenessUpdate,
	removeAwarenessStates
} from 'y-protocols/awareness';
import { readSyncMessage, writeSyncStep1, writeUpdate } from 'y-protocols/sync';
import type * as Y from 'yjs';

/** What this module needs from a Trystero room (a subset, so tests can fake it). */
export interface PeerChannel<T> {
	send(
		data: T,
		options?: { target?: string | string[]; metadata?: Record<string, unknown> }
	): Promise<void>;
	onMessage: ((data: T, context: { peerId: string; metadata?: unknown }) => void) | null;
}
export interface PeerRoom {
	makeAction<T>(namespace: string): PeerChannel<T>;
	getPeers(): Record<string, unknown>;
	onPeerJoin: ((peerId: string) => void) | null;
	onPeerLeave: ((peerId: string) => void) | null;
	leave(): Promise<void>;
}

const bytes = (data: ArrayBuffer | Uint8Array) =>
	data instanceof Uint8Array ? data : new Uint8Array(data);

export class PeerSync {
	readonly awareness: Awareness;
	private readonly sync: PeerChannel<Uint8Array>;
	private readonly aware: PeerChannel<Uint8Array>;
	/** Awareness client ids each peer told us about, to clear them when it leaves. */
	private readonly clientsOf = new Map<string, Set<number>>();
	private readonly listeners = new Set<() => void>();

	constructor(
		readonly doc: Y.Doc,
		private readonly room: PeerRoom
	) {
		this.awareness = new Awareness(doc);
		this.sync = room.makeAction<Uint8Array>('y-sync');
		this.aware = room.makeAction<Uint8Array>('y-aware');
		this.sync.onMessage = (data, { peerId }) => this.onSync(bytes(data), peerId);
		this.aware.onMessage = (data, { peerId }) => this.onAware(bytes(data), peerId);
		room.onPeerJoin = (peerId) => this.greet(peerId);
		room.onPeerLeave = (peerId) => this.forget(peerId);
		doc.on('update', this.onDocUpdate);
		this.awareness.on('update', this.onAwarenessUpdate);
		for (const peerId of Object.keys(room.getPeers())) this.greet(peerId);
	}

	get peers(): number {
		return Object.keys(this.room.getPeers()).length;
	}

	/** Called when peers join or leave. */
	subscribe(fn: () => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	async destroy(): Promise<void> {
		this.doc.off('update', this.onDocUpdate);
		this.awareness.off('update', this.onAwarenessUpdate);
		removeAwarenessStates(this.awareness, [this.doc.clientID], 'local');
		this.awareness.destroy();
		this.room.onPeerJoin = null;
		this.room.onPeerLeave = null;
		this.listeners.clear();
		await this.room.leave();
	}

	private greet(peerId: string): void {
		const encoder = encoding.createEncoder();
		writeSyncStep1(encoder, this.doc);
		void this.sync.send(encoding.toUint8Array(encoder), { target: peerId });
		const states = [...this.awareness.getStates().keys()];
		if (states.length > 0) {
			void this.aware.send(encodeAwarenessUpdate(this.awareness, states), { target: peerId });
		}
		this.emit();
	}

	private forget(peerId: string): void {
		const ids = this.clientsOf.get(peerId);
		this.clientsOf.delete(peerId);
		if (ids?.size) removeAwarenessStates(this.awareness, [...ids], 'remote');
		this.emit();
	}

	private onSync(data: Uint8Array, peerId: string): void {
		const decoder = decoding.createDecoder(data);
		const reply = encoding.createEncoder();
		readSyncMessage(decoder, reply, this.doc, this);
		// Step 1 asks for what we have that they don't: answer that peer only.
		if (encoding.length(reply) > 0) {
			void this.sync.send(encoding.toUint8Array(reply), { target: peerId });
		}
	}

	private onAware(data: Uint8Array, peerId: string): void {
		// Remember whose states came from this peer (decode the client ids up front).
		const decoder = decoding.createDecoder(data);
		const n = decoding.readVarUint(decoder);
		const ids = this.clientsOf.get(peerId) ?? new Set<number>();
		for (let i = 0; i < n; i++) {
			ids.add(decoding.readVarUint(decoder));
			decoding.readVarUint(decoder); // clock
			decoding.readVarString(decoder); // state
		}
		this.clientsOf.set(peerId, ids);
		applyAwarenessUpdate(this.awareness, data, peerId);
	}

	private readonly onDocUpdate = (update: Uint8Array, origin: unknown) => {
		if (origin === this) return;
		const encoder = encoding.createEncoder();
		writeUpdate(encoder, update);
		void this.sync.send(encoding.toUint8Array(encoder));
	};

	private readonly onAwarenessUpdate = (
		{ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
		origin: unknown
	) => {
		// Only our own changes go out; states from peers are theirs to send.
		if (origin !== 'local' && origin !== undefined && origin !== null) return;
		const changed = [...added, ...updated, ...removed];
		void this.aware.send(encodeAwarenessUpdate(this.awareness, changed));
	};

	private emit(): void {
		for (const fn of this.listeners) fn();
	}
}
