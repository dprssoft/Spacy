import { beforeEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { getElement } from '$lib/model/doc';
import { createElements } from '$lib/model/ops';
import { samples } from '$lib/model/testFixtures';
import { loadSnapshot, openBoard, writeSnapshot } from '../boardDoc';
import * as boardsRepo from '../boardsRepo';
import { freshDB } from '../testUtils';
import { SyncEngine } from './engine';
import { onDirty } from './hub';
import { createIdbSyncLocal, idbSyncState } from './idbLocal';

const idbSyncLocal = createIdbSyncLocal();
import { MemoryRemoteStore } from './remote';

beforeEach(freshDB);

function dirtyLog() {
	const seen: string[] = [];
	const off = onDirty((b) => seen.push(b));
	return { seen, off };
}

describe('sync with IndexedDB boards', () => {
	it('an open board reports local edits and applies remote ones live, outside undo', async () => {
		const { id } = await boardsRepo.create();
		const board = await openBoard(id);
		const log = dirtyLog();
		createElements(board.doc, [samples.shape('s1')]);
		expect(log.seen).toContain(id);
		log.seen.length = 0;

		const remote = new Y.Doc();
		Y.applyUpdate(remote, Y.encodeStateAsUpdate(board.doc));
		createElements(remote, [samples.sticky('r1')]);
		await idbSyncLocal.apply(id, Y.encodeStateAsUpdate(remote));
		expect(getElement(board.doc, 'r1')?.type).toBe('sticky');
		expect(log.seen).toEqual([]);
		board.undo.undo();
		expect(getElement(board.doc, 'r1')).not.toBeNull();
		expect(getElement(board.doc, 's1')).toBeNull();
		log.off();
		await board.close();
	});

	it('a closed board is merged into storage', async () => {
		const { id } = await boardsRepo.create();
		const remote = new Y.Doc();
		createElements(remote, [samples.shape('s1')]);
		const log = dirtyLog();
		await idbSyncLocal.apply(id, Y.encodeStateAsUpdate(remote));
		expect(log.seen).toEqual([]);
		const doc = new Y.Doc();
		Y.applyUpdate(doc, await idbSyncLocal.read(id));
		expect(getElement(doc, 's1')).not.toBeNull();
		log.off();
	});

	it('imports and templates written to storage are reported', async () => {
		const { id } = await boardsRepo.create();
		const log = dirtyLog();
		await writeSnapshot(id, Y.encodeStateAsUpdate(new Y.Doc()));
		expect(log.seen).toEqual([id]);
		log.off();
	});

	it('syncs boards between two browsers through the engine', async () => {
		const store = new MemoryRemoteStore();
		const { id } = await boardsRepo.create();
		const board = await openBoard(id);
		createElements(board.doc, [samples.shape('s1')]);
		const engine = new SyncEngine({ store, local: idbSyncLocal, state: idbSyncState, device: 'A' });
		await engine.cycle();
		await board.close();
		expect(await idbSyncState.get('cursor')).toBeTypeOf('string');

		// The other browser: a fresh database, the same remote.
		await freshDB();
		await boardsRepo.create();
		const other = new SyncEngine({ store, local: idbSyncLocal, state: idbSyncState, device: 'B' });
		await other.cycle();
		const doc = new Y.Doc();
		Y.applyUpdate(doc, await loadSnapshot(id));
		expect(getElement(doc, 's1')?.type).toBe('shape');
	});
});
