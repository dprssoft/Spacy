import * as Y from 'yjs';
import { getMeta } from '$lib/model/doc';
import { SCHEMA_VERSION } from '$lib/model/migrations';
import { RemoteNotFoundError, type RemoteStore } from './remote';
import type { SyncStatus } from './status';

/** This device's boards, as the engine sees them. */
export interface SyncLocal {
	boardIds(): Promise<string[]>;
	/** The board's full content as one update (empty doc state when it has none). */
	read(boardId: string): Promise<Uint8Array>;
	/** Merges remote changes into the board (origin `REMOTE_SYNC`). */
	apply(boardId: string, update: Uint8Array): Promise<void>;
	/** Boards deleted forever: never downloaded or uploaded again, their remote files removed. */
	purgedBoards?(): Promise<Set<string>>;
	/**
	 * Runs after downloads, before uploads (the board list reconciles here). Returns boards it
	 * changed, which are uploaded in this cycle too.
	 */
	afterDownload?(): Promise<Iterable<string>>;
}

/** Persistent key-value storage for the engine's own bookkeeping. */
export interface SyncStateStore {
	get(key: string): Promise<unknown>;
	set(key: string, value: unknown): Promise<void>;
}

type FileKind = 'update' | 'snapshot';

/** A remote board file this device knows about. `applied`: its content is in the local board. */
interface IndexEntry {
	board: string;
	kind: FileKind;
	device: string;
	applied: boolean;
}
type FileIndex = Record<string, IndexEntry>;

export const COMPACT_AT = 50;

const KEY_CURSOR = 'cursor';
const KEY_INDEX = 'index';
const KEY_SEQ = 'seq';
// What was last uploaded or downloaded for a board, as a Yjs snapshot (state vector + delete set).
// A state vector alone would miss deletions, which don't advance it.
const keySynced = (board: string) => `synced:${board}`;

export interface SyncEngineOptions {
	store: RemoteStore;
	local: SyncLocal;
	state: SyncStateStore;
	device: string;
	status?: SyncStatus;
	compactAt?: number;
	now?: () => number;
}

/**
 * Keeps every board's Yjs doc in sync with a remote file store. Each upload is one immutable file
 * holding the changes since the last sync; downloads apply other devices' files. Yjs merges are
 * idempotent, so a repeated upload or download is harmless and every step can simply be retried.
 */
export class SyncEngine {
	private chain: Promise<void> = Promise.resolve();
	private readonly paused = new Set<string>();

	constructor(private readonly o: SyncEngineOptions) {}

	/** One sync cycle: download everything new, then upload changes of `boards`. Serialised. */
	cycle(boards: Iterable<string> | 'all' = 'all'): Promise<void> {
		const targets = boards === 'all' ? 'all' : [...boards];
		const run = this.chain.then(() => this.runCycle(targets));
		this.chain = run.catch(() => {});
		return run;
	}

	private async runCycle(boards: string[] | 'all'): Promise<void> {
		const { status } = this.o;
		status?.set({ kind: 'syncing' });
		try {
			const index = await this.fetchChanges();
			this.paused.clear();
			const pending = new Map<string, string[]>();
			for (const [id, e] of Object.entries(index)) {
				if (!e.applied) pending.set(e.board, [...(pending.get(e.board) ?? []), id]);
			}
			// One board failing doesn't hold up the others; the cycle still fails at the end.
			const errors: unknown[] = [];
			const each = async (board: string, step: () => Promise<void>) => {
				try {
					await step();
				} catch (err) {
					errors.push(err);
					status?.setBoard(board, { kind: 'error', reason: messageOf(err) });
				}
			};
			let purged = await this.purged();
			for (const [board, ids] of pending) {
				if (!purged.has(board)) await each(board, () => this.download(board, ids, index));
			}

			const changed = (await this.o.local.afterDownload?.()) ?? [];
			purged = await this.purged();
			await this.removePurged(purged, index);
			const targets = new Set(boards === 'all' ? await this.o.local.boardIds() : boards);
			for (const board of changed) targets.add(board);
			for (const board of targets) {
				if (!this.paused.has(board) && !purged.has(board)) {
					await each(board, () => this.upload(board, index));
				}
			}
			if (errors.length > 0) throw errors[0];
			status?.set({ kind: 'synced', at: this.now() });
		} catch (err) {
			status?.set({ kind: 'error', reason: messageOf(err) });
			throw err;
		}
	}

	private async fetchChanges(): Promise<FileIndex> {
		const { store, state, device } = this.o;
		const index = await this.loadIndex();
		const cursor = await state.get(KEY_CURSOR);
		const changes = await store.changes(typeof cursor === 'string' ? cursor : null);
		for (const id of changes.removed) delete index[id];
		for (const f of changes.files) {
			const { kind, board } = f.props;
			if (index[f.id] || !board || (kind !== 'update' && kind !== 'snapshot')) continue;
			const from = f.props.device ?? '';
			index[f.id] = { board, kind, device: from, applied: from === device };
		}
		await state.set(KEY_INDEX, index);
		await state.set(KEY_CURSOR, changes.cursor);
		return index;
	}

	private async download(board: string, ids: string[], index: FileIndex): Promise<void> {
		const { store, local, state, status } = this.o;
		const updates: Uint8Array[] = [];
		const got: string[] = [];
		for (const id of ids) {
			try {
				updates.push(await store.read(id));
				got.push(id);
			} catch (err) {
				// Compacted by another device; its snapshot arrives as a new file.
				if (!(err instanceof RemoteNotFoundError)) throw err;
				delete index[id];
			}
		}
		if (updates.length > 0) {
			const incoming = Y.mergeUpdates(updates);
			const before = await local.read(board);
			const merged = Y.mergeUpdates([before, incoming]);
			const version = schemaVersionOf(merged);
			if (version > SCHEMA_VERSION) {
				this.paused.add(board);
				status?.setBoard(board, { kind: 'newer-schema', version });
				await state.set(KEY_INDEX, index);
				return;
			}
			status?.setBoard(board, { kind: 'syncing' });
			await local.apply(board, incoming);
			// Nothing local was waiting to upload: what we hold now is all on the remote too.
			const synced = await this.syncedSnapshot(board);
			const was = snapshotOf(before);
			if (synced ? Y.equalSnapshots(synced, was) : isEmpty(was)) {
				await state.set(keySynced(board), Y.encodeSnapshot(snapshotOf(merged)));
			}
			for (const id of got) {
				const e = index[id];
				if (e) e.applied = true;
			}
		}
		await state.set(KEY_INDEX, index);
	}

	private async upload(board: string, index: FileIndex): Promise<void> {
		const { store, local, state, device, status } = this.o;
		const content = await local.read(board);
		const snap = snapshotOf(content);
		const synced = await this.syncedSnapshot(board);
		if (!synced && isEmpty(snap)) return;
		if (!synced || !Y.equalSnapshots(synced, snap)) {
			status?.setBoard(board, { kind: 'syncing' });
			const delta = synced ? Y.diffUpdate(content, Y.encodeStateVector(synced.sv)) : content;
			const seq = await this.nextSeq();
			const file = await store.create(
				`${board}.${device}.${seq}.yjs`,
				{ kind: 'update', board, device, seq: String(seq) },
				delta
			);
			index[file.id] = { board, kind: 'update', device, applied: true };
			await state.set(KEY_INDEX, index);
			await state.set(keySynced(board), Y.encodeSnapshot(snap));
		}
		await this.compact(board, content, index);
		status?.setBoard(board, { kind: 'synced', at: this.now() });
	}

	/**
	 * Replaces a board's many small files with one snapshot. Only files whose content is in
	 * `content` are deleted; files from other devices that haven't arrived here yet stay.
	 */
	private async compact(board: string, content: Uint8Array, index: FileIndex): Promise<void> {
		const { store, state, device } = this.o;
		const files = Object.entries(index).filter(([, e]) => e.board === board);
		if (files.length < (this.o.compactAt ?? COMPACT_AT)) return;
		const merged = files.filter(([, e]) => e.applied).map(([id]) => id);
		const seq = await this.nextSeq();
		const file = await store.create(
			`${board}.${device}.${seq}.snapshot.yjs`,
			{ kind: 'snapshot', board, device, seq: String(seq) },
			content
		);
		index[file.id] = { board, kind: 'snapshot', device, applied: true };
		await state.set(KEY_INDEX, index);
		for (const id of merged) {
			await store.remove(id);
			delete index[id];
			await state.set(KEY_INDEX, index);
		}
	}

	private async purged(): Promise<Set<string>> {
		return (await this.o.local.purgedBoards?.()) ?? new Set();
	}

	private async removePurged(purged: Set<string>, index: FileIndex): Promise<void> {
		for (const [id, e] of Object.entries(index)) {
			if (!purged.has(e.board)) continue;
			await this.o.store.remove(id);
			delete index[id];
			await this.o.state.set(KEY_INDEX, index);
		}
	}

	private async loadIndex(): Promise<FileIndex> {
		const v = await this.o.state.get(KEY_INDEX);
		return v && typeof v === 'object' ? { ...(v as FileIndex) } : {};
	}

	private async syncedSnapshot(board: string): Promise<Y.Snapshot | null> {
		const v = await this.o.state.get(keySynced(board));
		return ArrayBuffer.isView(v)
			? Y.decodeSnapshot(new Uint8Array(v.buffer, v.byteOffset, v.byteLength))
			: null;
	}

	private async nextSeq(): Promise<number> {
		const v = await this.o.state.get(KEY_SEQ);
		const seq = (typeof v === 'number' ? v : 0) + 1;
		await this.o.state.set(KEY_SEQ, seq);
		return seq;
	}

	private now(): number {
		return (this.o.now ?? Date.now)();
	}
}

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

const isEmpty = (snap: Y.Snapshot) => snap.sv.size === 0 && snap.ds.clients.size === 0;

function docOf(update: Uint8Array): Y.Doc {
	const doc = new Y.Doc();
	Y.applyUpdate(doc, update);
	return doc;
}

function snapshotOf(update: Uint8Array): Y.Snapshot {
	const doc = docOf(update);
	const snap = Y.snapshot(doc);
	doc.destroy();
	return snap;
}

function schemaVersionOf(update: Uint8Array): number {
	const doc = docOf(update);
	const v = getMeta(doc).get('schemaVersion');
	doc.destroy();
	return typeof v === 'number' ? v : 0;
}
