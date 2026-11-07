import type * as Y from 'yjs';
import { getMeta } from './doc';
import { MIGRATION } from './origins';

export const SCHEMA_VERSION = 9;

/** migrations[n] upgrades a doc from version n-1 to n. Version 1 is the initial schema. */
export const migrations: Record<number, (doc: Y.Doc) => void> = {
	// 2: pages. A board without a page list has one page whose elements are the original
	// `elements` map, so nothing moves. The version still goes up: an app that doesn't know about
	// pages must not open (and clean up after) a board that may have more of them.
	2: () => {},
	// 3: sketch elements (many brush strokes in one object, stored in `sketches`). Nothing to
	// convert; older versions would drop the unknown element type, so they must not open the board.
	3: () => {},
	// 4: doc card text formatting (underline, color, highlight, font, size as marks; alignment as
	// a block attribute). Nothing to convert; an older editor deletes text whose marks it doesn't
	// know, so older versions must not open the board.
	4: () => {},
	// 5: media elements (links that play on the board). Nothing to convert; older versions would
	// drop the unknown element type from their view, so they must not open the board.
	5: () => {},
	// 6: comments (a `comments` map and a `comment` mark in doc card text). Nothing to convert; an
	// older editor deletes text carrying a mark it doesn't know, so older versions must not open it.
	6: () => {},
	// 7: waystones (named checkpoints on a page). Nothing to convert; older versions would drop the
	// unknown element type from their view, so they must not open the board.
	7: () => {},
	// 8: widgets (timers, wheels, votes… and the `widgets` map). Nothing to convert; older versions
	// would drop the unknown element type from their view, so they must not open the board.
	8: () => {},
	// 9: tables in doc cards. Nothing to convert; an older editor deletes table nodes it doesn't
	// know, so older versions must not open the board.
	9: () => {}
};

export class NewerSchemaError extends Error {
	constructor(readonly version: number) {
		super(`Board schema version ${version} is newer than supported (${SCHEMA_VERSION})`);
		this.name = 'NewerSchemaError';
	}
}

/** Brings a board doc to SCHEMA_VERSION. Run on every open; a no-op when already current. */
export function migrate(doc: Y.Doc): void {
	const stored = getMeta(doc).get('schemaVersion');
	const version = typeof stored === 'number' ? stored : 0;
	if (version > SCHEMA_VERSION) throw new NewerSchemaError(version);
	if (version === SCHEMA_VERSION) return;
	doc.transact(() => {
		for (let v = version + 1; v <= SCHEMA_VERSION; v++) migrations[v]?.(doc);
		getMeta(doc).set('schemaVersion', SCHEMA_VERSION);
	}, MIGRATION);
}
