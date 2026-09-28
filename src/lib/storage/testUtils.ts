// Test helpers for IndexedDB-backed modules. Not imported by app code.
import { deleteDB } from 'idb';
import { DB_NAME, resetDBForTests } from './db';

export async function freshDB(): Promise<void> {
	await resetDBForTests();
	await deleteDB(DB_NAME);
}
