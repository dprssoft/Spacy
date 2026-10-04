import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createBoardUndo } from '$lib/storage/boardDoc';
import { setDocContent } from '$lib/templates/docContent';
import {
	commentQuotes,
	copyThreadsTo,
	createThread,
	deleteMessage,
	deleteThread,
	editMessage,
	getCommentsMap,
	listThreads,
	parseThreads,
	remapCommentMarks,
	reply,
	setResolved,
	threadsOn
} from './comments';
import { getDocsMap } from './doc';
import { migrate, SCHEMA_VERSION } from './migrations';
import { createElements, deleteElements } from './ops';
import { IMPORT } from './origins';
import { samples } from './testFixtures';

const onSticky = (doc: Y.Doc, text = 'First') =>
	createThread(doc, {
		anchor: { kind: 'element', elementId: 'sticky1' },
		page: 'main',
		author: 'Ann',
		text
	});

/** A doc card whose text "Hello brave world" has "brave" commented with `threadId`. */
function cardWithComment(doc: Y.Doc, cardId: string, threadId: string): Y.XmlFragment {
	const frag = new Y.XmlFragment();
	doc.transact(() => getDocsMap(doc).set(cardId, frag));
	setDocContent(frag, {
		type: 'doc',
		content: [
			{
				type: 'paragraph',
				content: [
					{ type: 'text', text: 'Hello ' },
					{ type: 'text', text: 'brave', marks: [{ type: 'comment', attrs: { threadId } }] },
					{ type: 'text', text: ' world' }
				]
			}
		]
	});
	return frag;
}

describe('comment threads', () => {
	it('creates, replies, edits, resolves and lists threads', () => {
		const doc = new Y.Doc();
		const id = onSticky(doc, '  Needs a better title  ');
		reply(doc, id, 'Bo', 'Agreed');
		let [t] = listThreads(doc);
		expect(t).toMatchObject({
			id,
			anchor: { kind: 'element', elementId: 'sticky1' },
			page: 'main',
			resolved: false
		});
		expect(t!.messages.map((m) => [m.author, m.text])).toEqual([
			['Ann', 'Needs a better title'],
			['Bo', 'Agreed']
		]);

		editMessage(doc, id, t!.messages[1]!.id, 'Agreed!');
		setResolved(doc, id, true);
		[t] = listThreads(doc);
		expect(t!.messages[1]).toMatchObject({ text: 'Agreed!', editedAt: expect.any(Number) });
		expect(t!.resolved).toBe(true);
	});

	it('deleting the last message deletes the thread', () => {
		const doc = new Y.Doc();
		const id = onSticky(doc);
		reply(doc, id, 'Bo', 'Second');
		const [first, second] = listThreads(doc)[0]!.messages;
		deleteMessage(doc, id, first!.id);
		expect(listThreads(doc)[0]!.messages).toHaveLength(1);
		deleteMessage(doc, id, second!.id);
		expect(getCommentsMap(doc).size).toBe(0);
	});

	it('ignores malformed threads', () => {
		const doc = new Y.Doc();
		doc.transact(() => {
			const bad = new Y.Map<unknown>();
			bad.set('anchor', { kind: 'nope' });
			getCommentsMap(doc).set('bad', bad);
		});
		onSticky(doc);
		expect(listThreads(doc)).toHaveLength(1);
		expect(parseThreads([{ id: 'x' }, ...listThreads(doc), 'junk'])).toHaveLength(1);
		expect(parseThreads('nope')).toEqual([]);
	});

	it('undoes creating, replying and resolving as separate steps', () => {
		const doc = new Y.Doc();
		const undo = createBoardUndo(doc);
		const id = onSticky(doc);
		undo.stopCapturing();
		reply(doc, id, 'Bo', 'Reply');
		undo.stopCapturing();
		setResolved(doc, id, true);
		undo.undo();
		expect(listThreads(doc)[0]!.resolved).toBe(false);
		undo.undo();
		expect(listThreads(doc)[0]!.messages).toHaveLength(1);
		undo.undo();
		expect(listThreads(doc)).toEqual([]);
		undo.redo();
		expect(listThreads(doc)).toHaveLength(1);
	});
});

describe('element deletion', () => {
	it('deletes element threads and text threads of a deleted card in the same step', () => {
		const doc = new Y.Doc();
		const undo = createBoardUndo(doc);
		createElements(doc, [samples.sticky(), samples.doccard(), samples.shape()]);
		onSticky(doc);
		cardWithComment(doc, 'doc1', 't1');
		createThread(doc, {
			anchor: { kind: 'text', cardId: 'doc1' },
			page: 'main',
			author: 'Ann',
			text: 'Brave?',
			id: 't1'
		});
		createThread(doc, {
			anchor: { kind: 'element', elementId: 'shape1' },
			page: 'main',
			author: 'Ann',
			text: 'Keep'
		});
		undo.stopCapturing();
		deleteElements(doc, ['sticky1', 'doc1']);
		expect(listThreads(doc).map((t) => t.messages[0]!.text)).toEqual(['Keep']);
		undo.undo();
		expect(listThreads(doc)).toHaveLength(3);
	});
});

describe('text marks', () => {
	it('quotes commented text, keeps orphaned threads and removes the highlight with the thread', () => {
		const doc = new Y.Doc();
		const frag = cardWithComment(doc, 'doc1', 't1');
		const id = createThread(doc, {
			anchor: { kind: 'text', cardId: 'doc1' },
			page: 'main',
			author: 'Ann',
			text: 'Brave?',
			id: 't1'
		});
		expect(commentQuotes(frag)).toEqual(new Map([['t1', 'brave']]));

		deleteThread(doc, id);
		expect(commentQuotes(frag).size).toBe(0);
		expect(frag.toJSON()).toContain('Hello brave world');
	});

	it('an orphaned text thread (its text deleted) stays listed', () => {
		const doc = new Y.Doc();
		const frag = cardWithComment(doc, 'doc1', 't1');
		createThread(doc, {
			anchor: { kind: 'text', cardId: 'doc1' },
			page: 'main',
			author: 'Ann',
			text: 'Brave?',
			id: 't1'
		});
		const text = (frag.get(0) as Y.XmlElement).get(0) as Y.XmlText;
		doc.transact(() => text.delete(0, text.length));
		expect(commentQuotes(frag).size).toBe(0);
		expect(listThreads(doc)).toHaveLength(1);
	});

	it('remaps and removes marks', () => {
		const doc = new Y.Doc();
		const frag = cardWithComment(doc, 'doc1', 'a');
		doc.transact(() => remapCommentMarks(frag, () => 'b'));
		expect(commentQuotes(frag)).toEqual(new Map([['b', 'brave']]));
		doc.transact(() => remapCommentMarks(frag, () => null));
		expect(commentQuotes(frag).size).toBe(0);
	});
});

describe('copyThreadsTo', () => {
	it('copies element and text threads onto copies and repoints copied marks', () => {
		const doc = new Y.Doc();
		onSticky(doc);
		cardWithComment(doc, 'doc1', 't1');
		createThread(doc, {
			anchor: { kind: 'text', cardId: 'doc1' },
			page: 'main',
			author: 'Ann',
			text: 'Brave?',
			id: 't1'
		});
		const threads = threadsOn(doc, new Set(['sticky1', 'doc1']));
		expect(threads).toHaveLength(2);

		// The copy's fragment is a clone with the same marks; one stray mark of an uncopied thread.
		const copy = cardWithComment(doc, 'doc2', 't1');
		doc.transact(() =>
			copyThreadsTo(
				doc,
				threads,
				new Map([
					['sticky1', 'sticky2'],
					['doc1', 'doc2']
				]),
				'p2'
			)
		);
		const all = listThreads(doc);
		expect(all).toHaveLength(4);
		const stickyCopy = all.find(
			(t) => t.anchor.kind === 'element' && t.anchor.elementId === 'sticky2'
		);
		const textCopy = all.find((t) => t.anchor.kind === 'text' && t.anchor.cardId === 'doc2');
		expect(stickyCopy).toMatchObject({ page: 'p2', messages: [{ text: 'First' }] });
		expect(commentQuotes(copy)).toEqual(new Map([[textCopy!.id, 'brave']]));
		expect(commentQuotes(getDocsMap(doc).get('doc1')!)).toEqual(new Map([['t1', 'brave']]));
	});
});

describe('schema version 6', () => {
	it('migrates a v5 doc without moving data', () => {
		const doc = new Y.Doc();
		doc.transact(() => doc.getMap('meta').set('schemaVersion', 5), IMPORT);
		migrate(doc);
		expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(6);
		expect(doc.getMap('meta').get('schemaVersion')).toBe(SCHEMA_VERSION);
		expect(getCommentsMap(doc).size).toBe(0);
	});
});
