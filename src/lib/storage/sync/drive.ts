// `RemoteStore` on Google Drive's hidden app folder (Drive API v3 over fetch, no SDK). The app can
// see only its own files there (scope `drive.appdata`), and the user can't open them in Drive.
import { AuthRequiredError, type SyncAuth } from './auth';
import {
	RemoteNotFoundError,
	type RemoteChanges,
	type RemoteFile,
	type RemoteStore
} from './remote';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FILE_FIELDS = 'id,name,appProperties,size';
/** Larger bodies go through a resumable session (Drive's limit for multipart is 5 MB). */
export const MULTIPART_MAX = 5 * 1024 * 1024;
const MAX_ATTEMPTS = 4;

export class DriveError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
		this.name = 'DriveError';
	}
}

interface DriveFile {
	id: string;
	name?: string;
	appProperties?: Record<string, string>;
	size?: string;
	trashed?: boolean;
}

const toRemote = (f: DriveFile): RemoteFile => ({
	id: f.id,
	name: f.name ?? '',
	props: f.appProperties ?? {},
	size: Number(f.size ?? 0)
});

export interface DriveOptions {
	fetch?: typeof fetch;
	sleep?: (ms: number) => Promise<void>;
}

export class GoogleDriveStore implements RemoteStore {
	private readonly fetch: typeof fetch;
	private readonly sleep: (ms: number) => Promise<void>;

	constructor(
		private readonly auth: SyncAuth,
		opts: DriveOptions = {}
	) {
		this.fetch = opts.fetch ?? ((...a) => fetch(...a));
		this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
	}

	async changes(cursor: string | null): Promise<RemoteChanges> {
		if (cursor === null) {
			// Take the token first: changes made while listing show up again later (harmless).
			const start = await this.json<{ startPageToken: string }>(`${API}/changes/startPageToken`);
			const files: RemoteFile[] = [];
			let page: string | undefined;
			do {
				const q = new URLSearchParams({
					spaces: 'appDataFolder',
					fields: `nextPageToken,files(${FILE_FIELDS})`,
					pageSize: '1000',
					...(page ? { pageToken: page } : {})
				});
				const r = await this.json<{ files: DriveFile[]; nextPageToken?: string }>(
					`${API}/files?${q}`
				);
				files.push(...r.files.map(toRemote));
				page = r.nextPageToken;
			} while (page);
			return { files, removed: [], cursor: start.startPageToken };
		}
		const files: RemoteFile[] = [];
		const removed: string[] = [];
		let page = cursor;
		for (;;) {
			const q = new URLSearchParams({
				pageToken: page,
				spaces: 'appDataFolder',
				pageSize: '1000',
				fields: `nextPageToken,newStartPageToken,changes(fileId,removed,file(${FILE_FIELDS},trashed))`
			});
			const r = await this.json<{
				changes: { fileId: string; removed?: boolean; file?: DriveFile }[];
				nextPageToken?: string;
				newStartPageToken?: string;
			}>(`${API}/changes?${q}`);
			for (const c of r.changes) {
				if (c.removed || !c.file || c.file.trashed) removed.push(c.fileId);
				else files.push(toRemote(c.file));
			}
			if (r.newStartPageToken) return { files, removed, cursor: r.newStartPageToken };
			if (!r.nextPageToken) return { files, removed, cursor: page };
			page = r.nextPageToken;
		}
	}

	async create(
		name: string,
		props: Record<string, string>,
		body: Uint8Array | Blob
	): Promise<RemoteFile> {
		const blob = body instanceof Blob ? body : new Blob([body as BlobPart]);
		const meta = { name, parents: ['appDataFolder'], appProperties: props };
		const type = blob.type || 'application/octet-stream';
		if (blob.size <= MULTIPART_MAX) {
			const boundary = `spacy${Math.random().toString(36).slice(2)}`;
			const multipart = new Blob([
				`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
				`--${boundary}\r\nContent-Type: ${type}\r\n\r\n`,
				blob,
				`\r\n--${boundary}--`
			]);
			const f = await this.json<DriveFile>(`${UPLOAD}?uploadType=multipart&fields=${FILE_FIELDS}`, {
				method: 'POST',
				headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
				body: multipart
			});
			return toRemote(f);
		}
		const session = await this.request(`${UPLOAD}?uploadType=resumable&fields=${FILE_FIELDS}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json; charset=UTF-8',
				'X-Upload-Content-Type': type,
				'X-Upload-Content-Length': String(blob.size)
			},
			body: JSON.stringify(meta)
		});
		const location = session.headers.get('Location');
		if (!location) throw new DriveError(session.status, 'Drive gave no upload address');
		const f = (await (
			await this.request(location, { method: 'PUT', body: blob })
		).json()) as DriveFile;
		return toRemote(f);
	}

	async read(id: string): Promise<Uint8Array> {
		try {
			const r = await this.request(`${API}/files/${encodeURIComponent(id)}?alt=media`);
			return new Uint8Array(await r.arrayBuffer());
		} catch (err) {
			if (err instanceof DriveError && err.status === 404) throw new RemoteNotFoundError(id);
			throw err;
		}
	}

	async remove(id: string): Promise<void> {
		try {
			await this.request(`${API}/files/${encodeURIComponent(id)}`, { method: 'DELETE' });
		} catch (err) {
			if (!(err instanceof DriveError && err.status === 404)) throw err;
		}
	}

	/** Deletes everything Spacy keeps in the user's Drive (disconnect with "also delete"). */
	async removeAll(): Promise<void> {
		const { files } = await this.changes(null);
		for (const f of files) await this.remove(f.id);
	}

	/** The signed-in account's address, for Settings; null if Drive won't say. */
	async accountEmail(): Promise<string | null> {
		try {
			const r = await this.json<{ user?: { emailAddress?: string } }>(
				`${API}/about?fields=user(emailAddress)`
			);
			return r.user?.emailAddress ?? null;
		} catch {
			return null;
		}
	}

	private async json<T>(url: string, init?: RequestInit): Promise<T> {
		return (await (await this.request(url, init)).json()) as T;
	}

	/** One API call with the token; a rejected token is renewed once, rate limits back off. */
	private async request(url: string, init: RequestInit = {}): Promise<Response> {
		let renewed = false;
		for (let attempt = 1; ; attempt++) {
			const token = await this.auth.getToken({ force: renewed });
			const headers = new Headers(init.headers);
			headers.set('Authorization', `Bearer ${token}`);
			const r = await this.fetch(url, { ...init, headers });
			if (r.ok) return r;
			if (r.status === 401 && !renewed) {
				renewed = true;
				attempt--;
				continue;
			}
			if (r.status === 401) throw new AuthRequiredError();
			if ((await isRateLimit(r)) && attempt < MAX_ATTEMPTS) {
				await this.sleep(1000 * 2 ** (attempt - 1) + Math.random() * 250);
				continue;
			}
			throw new DriveError(r.status, `Google Drive answered ${r.status}`);
		}
	}
}

async function isRateLimit(r: Response): Promise<boolean> {
	if (r.status === 429 || r.status >= 500) return true;
	if (r.status !== 403) return false;
	const body = await r
		.clone()
		.text()
		.catch(() => '');
	return /rateLimitExceeded|userRateLimitExceeded/.test(body);
}
