import type * as Y from 'yjs';
import { getMeta } from './doc';
import { MIGRATION } from './origins';

export const SCHEMA_VERSION = 1;

/** migrations[n] upgrades a doc from version n-1 to n. Version 1 is the initial schema. */
export const migrations: Record<number, (doc: Y.Doc) => void> = {};

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
