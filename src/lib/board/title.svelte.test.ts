import { beforeEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { getMeta } from '$lib/model/doc';
import { REMOTE_TAB } from '$lib/model/origins';
import * as boardsRepo from '$lib/storage/boardsRepo';
import { freshDB } from '$lib/storage/testUtils';
import { BoardTitle } from './title.svelte';

beforeEach(freshDB);

async function setup(initial = 'Plan') {
	const meta = await boardsRepo.create({ title: initial });
	const doc = new Y.Doc();
	getMeta(doc).set('title', initial);
	return { meta, doc, title: new BoardTitle(meta.id, doc) };
}

describe('BoardTitle', () => {
	it('reads the title from the doc', async () => {
		const { title } = await setup('Roadmap');
		expect(title.value).toBe('Roadmap');
	});

	it('renames the doc and the board list, trimming and ignoring empty names', async () => {
		const { meta, doc, title } = await setup();
		title.rename('  Launch  ');
		expect(getMeta(doc).get('title')).toBe('Launch');
		expect(title.value).toBe('Launch');
		await expect.poll(async () => (await boardsRepo.get(meta.id))?.title).toBe('Launch');

		title.rename('   ');
		expect(title.value).toBe('Launch');
	});

	it('follows renames from other tabs and mirrors them to the board list', async () => {
		const { meta, doc, title } = await setup();
		doc.transact(() => getMeta(doc).set('title', 'From tab B'), REMOTE_TAB);
		expect(title.value).toBe('From tab B');
		await expect.poll(async () => (await boardsRepo.get(meta.id))?.title).toBe('From tab B');
	});

	it('stops observing after destroy', async () => {
		const { doc, title } = await setup();
		title.destroy();
		getMeta(doc).set('title', 'Ignored');
		expect(title.value).toBe('Plan');
	});
});
