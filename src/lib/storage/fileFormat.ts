import * as Y from 'yjs';
import { z } from '$lib/shared/zod';
import { getDocsMap, getMeta, readElement } from '$lib/model/doc';
import { allPageMaps } from '$lib/model/pages';
import { migrate, NewerSchemaError } from '$lib/model/migrations';
import { IMPORT } from '$lib/model/origins';
import { base64ToBytes, bytesToBase64 } from '$lib/shared/base64';
import { setPref } from '$lib/shared/localPrefs';
import * as assetsRepo from './assetsRepo';
import { LAST_BACKUP_PREF } from './backupPrefs';
import { getDB } from './db';
import * as boardsRepo from './boardsRepo';
import { loadSnapshot, writeSnapshot } from './boardDoc';
import { destroyBoard } from './boardLifecycle';
import type { BoardMeta } from './types';

// `.smthng` files (00-architecture.md §10). Imports always create new boards and asset ids.

export const FILE_VERSION = 1;
const MAX_BYTES = 500 * 1024 * 1024;
const CONFIRM_BYTES = 100 * 1024 * 1024;

const base64 = z.string().refine((s) => {
	try {
		base64ToBytes(s);
		return true;
	} catch {
		return false;
	}
}, 'malformed base64 data');

const assetSchema = z.object({
	id: z.string().min(1),
	mime: z.string(),
	width: z.number().nonnegative(),
	height: z.number().nonnegative(),
	data: base64
});

const boardPayloadSchema = z.object({
	title: z.string(),
	createdAt: z.number(),
	doc: base64,
	assets: z.array(assetSchema)
});

const header = {
	format: z.literal('smthng'),
	version: z.literal(FILE_VERSION),
	exportedAt: z.number()
};
const fileSchema = z.discriminatedUnion('kind', [
	z.object({ ...header, kind: z.literal('board'), board: boardPayloadSchema }),
	z.object({ ...header, kind: z.literal('backup'), boards: z.array(z.unknown()) })
]);

export type BoardPayload = z.infer<typeof boardPayloadSchema>;
export type SmthngFile =
	| { format: 'smthng'; version: 1; kind: 'board'; exportedAt: number; board: BoardPayload }
	| { format: 'smthng'; version: 1; kind: 'backup'; exportedAt: number; boards: BoardPayload[] };

/** A file that can't be imported; `message` is meant for the user. */
export class InvalidFileError extends Error {
	override name = 'InvalidFileError';
}

// --- Export --------------------------------------------------------------------------------------

export async function exportBoardPayload(id: string): Promise<BoardPayload> {
	const meta = await boardsRepo.get(id);
	if (!meta) throw new Error(`Board ${id} not found`);
	const records = await (await getDB()).getAllFromIndex('assets', 'boardId', id);
	const assets = await Promise.all(
		records.map(async (r) => ({
			id: r.id,
			mime: r.mime,
			width: r.width,
			height: r.height,
			data: bytesToBase64(new Uint8Array(await r.blob.arrayBuffer()))
		}))
	);
	return {
		title: meta.title,
		createdAt: meta.createdAt,
		doc: bytesToBase64(await loadSnapshot(id)),
		assets
	};
}

const jsonBlob = (data: unknown) => new Blob([JSON.stringify(data)], { type: 'application/json' });

export async function exportBoardFile(id: string): Promise<Blob> {
	const file: SmthngFile = {
		format: 'smthng',
		version: FILE_VERSION,
		kind: 'board',
		exportedAt: Date.now(),
		board: await exportBoardPayload(id)
	};
	return jsonBlob(file);
}

/** Every board not in the trash, in one file. */
export async function exportBackup(): Promise<Blob> {
	const metas = await boardsRepo.list({ filter: 'all', sort: 'created' });
	const boards: BoardPayload[] = [];
	for (const m of metas) boards.push(await exportBoardPayload(m.id));
	const file: SmthngFile = {
		format: 'smthng',
		version: FILE_VERSION,
		kind: 'backup',
		exportedAt: Date.now(),
		boards
	};
	const blob = jsonBlob(file);
	setPref(LAST_BACKUP_PREF, Date.now());
	return blob;
}

// --- Parse ---------------------------------------------------------------------------------------

export type ParsedFile =
	| { kind: 'board'; boards: BoardPayload[]; invalid: number }
	| { kind: 'backup'; boards: BoardPayload[]; invalid: number };

/** Validates a file. Backups keep their valid boards and count the invalid ones. */
export function parseSmthngFile(text: string): ParsedFile {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		throw new InvalidFileError('the file is not a SMTHNG file (not JSON)');
	}
	const head = z.object({ format: z.unknown(), version: z.unknown() }).safeParse(raw);
	if (!head.success || head.data.format !== 'smthng')
		throw new InvalidFileError('the file is not a SMTHNG file');
	if (typeof head.data.version === 'number' && head.data.version > FILE_VERSION)
		throw new InvalidFileError('This file was created with a newer version of SMTHNG.');
	const parsed = fileSchema.safeParse(raw);
	if (!parsed.success) throw new InvalidFileError(describe(parsed.error));
	if (parsed.data.kind === 'board')
		return { kind: 'board', boards: [parsed.data.board], invalid: 0 };
	const boards: BoardPayload[] = [];
	let invalid = 0;
	for (const b of parsed.data.boards) {
		const p = boardPayloadSchema.safeParse(b);
		if (p.success) boards.push(p.data);
		else invalid++;
	}
	if (boards.length === 0 && invalid > 0)
		throw new InvalidFileError('no valid boards in the backup');
	return { kind: 'backup', boards, invalid };
}

function describe(err: z.ZodError): string {
	const issue = err.issues[0];
	if (!issue) return 'the file is damaged';
	const path = issue.path.join('.');
	return path ? `the file is damaged (${path}: ${issue.message})` : 'the file is damaged';
}

// --- Import --------------------------------------------------------------------------------------

/** Creates a new board from a payload: new board id, new asset ids, invalid elements dropped. */
export async function importPayload(
	p: BoardPayload
): Promise<{ meta: BoardMeta; dropped: number }> {
	const doc = new Y.Doc();
	try {
		Y.applyUpdate(doc, base64ToBytes(p.doc), IMPORT);
	} catch {
		throw new InvalidFileError(`“${p.title}” has damaged content`);
	}
	try {
		migrate(doc);
	} catch (err) {
		if (err instanceof NewerSchemaError)
			throw new InvalidFileError('This file was created with a newer version of SMTHNG.');
		throw err;
	}

	const meta = await boardsRepo.create({ title: p.title, createdAt: p.createdAt });
	let dropped = 0;
	try {
		const assetIds = new Map<string, string>();
		for (const a of p.assets) {
			const blob = new Blob([base64ToBytes(a.data) as BlobPart], { type: a.mime });
			assetIds.set(a.id, await assetsRepo.put(meta.id, blob, { width: a.width, height: a.height }));
		}

		const docs = getDocsMap(doc);
		doc.transact(() => {
			// Every page of the board.
			for (const elements of allPageMaps(doc))
				for (const [id, value] of [...elements.entries()]) {
					const el = value instanceof Y.Map ? readElement(value) : null;
					if (!el || el.id !== id) {
						elements.delete(id);
						dropped++;
						continue;
					}
					if (el.type === 'image') {
						const next = assetIds.get(el.assetId);
						if (next) value.set('assetId', next);
					}
					if (el.type === 'doccard' && !(docs.get(id) instanceof Y.XmlFragment))
						docs.set(id, new Y.XmlFragment());
				}
			getMeta(doc).set('title', meta.title);
		}, IMPORT);

		await writeSnapshot(meta.id, Y.encodeStateAsUpdate(doc));
	} catch (err) {
		// Don't leave a half-imported board behind.
		await destroyBoard(meta.id).catch(() => {});
		throw err;
	} finally {
		doc.destroy();
	}
	return { meta, dropped };
}

export interface ImportResult {
	boards: BoardMeta[];
	warnings: string[];
}

/**
 * Imports a `.smthng` file (one board or a backup), board by board. Throws `InvalidFileError`
 * when nothing could be imported; partial problems are returned as warnings.
 */
export async function importFile(
	file: File,
	opts: { confirmLarge?: (file: File) => boolean | Promise<boolean> } = {}
): Promise<ImportResult> {
	if (file.size > MAX_BYTES) throw new InvalidFileError('the file is larger than 500 MB');
	if (file.size > CONFIRM_BYTES && opts.confirmLarge && !(await opts.confirmLarge(file)))
		return { boards: [], warnings: [] };
	const parsed = parseSmthngFile(await file.text());
	const boards: BoardMeta[] = [];
	const warnings: string[] = [];
	if (parsed.invalid) warnings.push(`${parsed.invalid} damaged board(s) were skipped`);
	for (const payload of parsed.boards) {
		try {
			const { meta, dropped } = await importPayload(payload);
			boards.push(meta);
			if (dropped) warnings.push(`“${meta.title}”: ${dropped} damaged object(s) were skipped`);
		} catch (err) {
			if (parsed.kind === 'board') throw err;
			warnings.push(err instanceof InvalidFileError ? err.message : `“${payload.title}” failed`);
		}
	}
	return { boards, warnings };
}
