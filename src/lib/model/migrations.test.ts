import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { getMeta } from './doc';
import { migrate, migrations, NewerSchemaError, SCHEMA_VERSION } from './migrations';
import { MIGRATION } from './origins';

afterEach(() => {
	for (const k of Object.keys(migrations)) delete migrations[Number(k)];
});

describe('migrate', () => {
	it('stamps a fresh doc with the current version using the MIGRATION origin', () => {
		const doc = new Y.Doc();
		const origins: unknown[] = [];
		doc.on('afterTransaction', (tr: Y.Transaction) => origins.push(tr.origin));
		migrate(doc);
		expect(getMeta(doc).get('schemaVersion')).toBe(SCHEMA_VERSION);
		expect(origins).toEqual([MIGRATION]);
	});

	it('is a no-op for a current doc', () => {
		const doc = new Y.Doc();
		migrate(doc);
		const onUpdate = vi.fn();
		doc.on('update', onUpdate);
		migrate(doc);
		expect(onUpdate).not.toHaveBeenCalled();
	});

	it('runs pending migrations in order', () => {
		const doc = new Y.Doc();
		const ran: number[] = [];
		migrations[1] = () => ran.push(1);
		migrate(doc);
		expect(ran).toEqual([1]);
	});

	it('throws for docs from a newer version', () => {
		const doc = new Y.Doc();
		getMeta(doc).set('schemaVersion', SCHEMA_VERSION + 1);
		expect(() => migrate(doc)).toThrow(NewerSchemaError);
	});
});
