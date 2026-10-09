// A remote store is a flat set of immutable files with string metadata (`props`). Files are only
// ever created and deleted, never edited, so two devices never write the same file.

export interface RemoteFile {
	id: string;
	name: string;
	props: Record<string, string>;
	size: number;
}

export interface RemoteChanges {
	files: RemoteFile[];
	removed: string[];
	cursor: string;
}

export interface RemoteStore {
	/** Files created and removed since `cursor` (`null`: every file that exists). */
	changes(cursor: string | null): Promise<RemoteChanges>;
	create(name: string, props: Record<string, string>, body: Uint8Array | Blob): Promise<RemoteFile>;
	/** Rejects with `RemoteNotFoundError` when the file no longer exists. */
	read(id: string): Promise<Uint8Array>;
	/** Removing a missing file succeeds. */
	remove(id: string): Promise<void>;
}

export class RemoteNotFoundError extends Error {
	constructor(readonly id: string) {
		super(`Remote file ${id} not found`);
		this.name = 'RemoteNotFoundError';
	}
}

type Op = 'changes' | 'create' | 'read' | 'remove';

/** In-memory `RemoteStore` for tests, shared by simulated devices. */
export class MemoryRemoteStore implements RemoteStore {
	private readonly files = new Map<string, { file: RemoteFile; body: Uint8Array }>();
	// A cursor is a position in this log.
	private readonly log: { created?: string; removed?: string }[] = [];
	private nextId = 1;
	/** Called before every operation; throw to simulate a failure. */
	failWhen: ((op: Op, arg: string) => boolean) | null = null;
	latencyMs = 0;
	readonly calls: Record<Op, number> = { changes: 0, create: 0, read: 0, remove: 0 };

	private async enter(op: Op, arg = ''): Promise<void> {
		this.calls[op]++;
		if (this.latencyMs) await new Promise((r) => setTimeout(r, this.latencyMs));
		if (this.failWhen?.(op, arg)) throw new Error(`Simulated ${op} failure`);
	}

	async changes(cursor: string | null): Promise<RemoteChanges> {
		await this.enter('changes', cursor ?? '');
		const end = String(this.log.length);
		if (cursor === null) {
			return { files: [...this.files.values()].map((f) => f.file), removed: [], cursor: end };
		}
		const files: RemoteFile[] = [];
		const removed: string[] = [];
		for (const entry of this.log.slice(Number(cursor))) {
			if (entry.created) {
				const f = this.files.get(entry.created);
				if (f) files.push(f.file);
			}
			if (entry.removed) removed.push(entry.removed);
		}
		return { files, removed, cursor: end };
	}

	async create(
		name: string,
		props: Record<string, string>,
		body: Uint8Array | Blob
	): Promise<RemoteFile> {
		await this.enter('create', name);
		const bytes = body instanceof Uint8Array ? body : new Uint8Array(await body.arrayBuffer());
		const file: RemoteFile = {
			id: `f${this.nextId++}`,
			name,
			props: { ...props },
			size: bytes.length
		};
		this.files.set(file.id, { file, body: bytes.slice() });
		this.log.push({ created: file.id });
		return file;
	}

	async read(id: string): Promise<Uint8Array> {
		await this.enter('read', id);
		const f = this.files.get(id);
		if (!f) throw new RemoteNotFoundError(id);
		return f.body.slice();
	}

	async remove(id: string): Promise<void> {
		await this.enter('remove', id);
		if (this.files.delete(id)) this.log.push({ removed: id });
	}

	/** Every file that exists now (for assertions). */
	list(): RemoteFile[] {
		return [...this.files.values()].map((f) => f.file);
	}
}
