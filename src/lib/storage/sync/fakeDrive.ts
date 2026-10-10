// An in-memory imitation of the parts of the Drive v3 API that `GoogleDriveStore` uses, for unit
// tests (as `fetch`) and e2e tests (behind Playwright routes). Not imported by app code; no imports,
// so the e2e runner can load it directly.

export interface FakeRequest {
	method: string;
	url: string;
	headers: Record<string, string>;
	body: Uint8Array;
}

export interface FakeResponse {
	status: number;
	headers: Record<string, string>;
	body: Uint8Array | string;
}

interface StoredFile {
	id: string;
	name: string;
	appProperties: Record<string, string>;
	data: Uint8Array;
}

const json = (status: number, v: unknown): FakeResponse => ({
	status,
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(v)
});

const latin1 = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join('');
const fromLatin1 = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

export class FakeDrive {
	readonly files = new Map<string, StoredFile>();
	private readonly log: { id: string; removed: boolean }[] = [];
	private readonly sessions = new Map<string, Omit<StoredFile, 'id' | 'data'>>();
	private next = 1;
	token = 'token-1';
	email = 'ann@example.com';
	/** Answer the next `n` calls with this status (rate limits, outages). */
	failNext: { status: number; n: number; body?: string } | null = null;
	readonly requests: string[] = [];

	handle(req: FakeRequest): FakeResponse {
		const url = new URL(req.url);
		this.requests.push(`${req.method} ${url.pathname}`);
		const auth = req.headers.authorization ?? req.headers.Authorization;
		if (auth !== `Bearer ${this.token}`) return json(401, { error: { code: 401 } });
		if (this.failNext && this.failNext.n > 0) {
			this.failNext.n--;
			return { status: this.failNext.status, headers: {}, body: this.failNext.body ?? '' };
		}
		const path = url.pathname;
		const q = url.searchParams;

		if (path === '/drive/v3/changes/startPageToken')
			return json(200, { startPageToken: String(this.log.length) });
		if (path === '/drive/v3/about') return json(200, { user: { emailAddress: this.email } });
		if (path === '/drive/v3/files' && req.method === 'GET') {
			return json(200, { files: [...this.files.values()].map((f) => this.meta(f)) });
		}
		if (path === '/drive/v3/changes') {
			const from = Number(q.get('pageToken'));
			const seen = new Set<string>();
			const changes = this.log
				.slice(from)
				.reverse()
				.filter((c) => !seen.has(c.id) && seen.add(c.id))
				.reverse()
				.map((c) => {
					const f = this.files.get(c.id);
					return f ? { fileId: c.id, file: this.meta(f) } : { fileId: c.id, removed: true };
				});
			return json(200, { changes, newStartPageToken: String(this.log.length) });
		}
		const fileMatch = /^\/drive\/v3\/files\/([^/]+)$/.exec(path);
		if (fileMatch) {
			const f = this.files.get(decodeURIComponent(fileMatch[1]!));
			if (!f) return json(404, { error: { code: 404 } });
			if (req.method === 'DELETE') {
				this.files.delete(f.id);
				this.log.push({ id: f.id, removed: true });
				return { status: 204, headers: {}, body: '' };
			}
			if (q.get('alt') === 'media') return { status: 200, headers: {}, body: f.data };
			return json(200, this.meta(f));
		}
		if (path === '/upload/drive/v3/files' && q.get('uploadType') === 'multipart') {
			const type = req.headers['content-type'] ?? req.headers['Content-Type'] ?? '';
			const boundary = /boundary=([^;]+)/.exec(type)?.[1];
			if (!boundary) return json(400, { error: 'no boundary' });
			const parts = latin1(req.body).split(`--${boundary}`).slice(1, 3);
			const body = (p: string) => p.slice(p.indexOf('\r\n\r\n') + 4).replace(/\r\n$/, '');
			const meta = JSON.parse(body(parts[0]!)) as {
				name: string;
				appProperties?: Record<string, string>;
			};
			return json(
				200,
				this.meta(this.add(meta.name, meta.appProperties ?? {}, fromLatin1(body(parts[1]!))))
			);
		}
		if (path === '/upload/drive/v3/files' && q.get('uploadType') === 'resumable') {
			const meta = JSON.parse(new TextDecoder().decode(req.body)) as {
				name: string;
				appProperties?: Record<string, string>;
			};
			const session = `s${this.next++}`;
			this.sessions.set(session, { name: meta.name, appProperties: meta.appProperties ?? {} });
			return {
				status: 200,
				headers: {
					Location: `https://www.googleapis.com/upload/drive/v3/files?upload_id=${session}`
				},
				body: ''
			};
		}
		if (path === '/upload/drive/v3/files' && req.method === 'PUT') {
			const s = this.sessions.get(q.get('upload_id') ?? '');
			if (!s) return json(404, { error: 'no session' });
			this.sessions.delete(q.get('upload_id')!);
			return json(200, this.meta(this.add(s.name, s.appProperties, req.body.slice())));
		}
		return json(400, { error: `unhandled ${req.method} ${path}` });
	}

	/** A `fetch` that talks to this fake. */
	fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
		const headers: Record<string, string> = {};
		new Headers(init.headers).forEach((v, k) => (headers[k] = v));
		const body = init.body
			? new Uint8Array(await new Response(init.body).arrayBuffer())
			: new Uint8Array();
		const r = this.handle({ method: init.method ?? 'GET', url: String(input), headers, body });
		const payload = typeof r.body === 'string' ? r.body : (r.body as BlobPart);
		return new Response(r.status === 204 ? null : payload, {
			status: r.status,
			headers: r.headers
		});
	};

	private add(name: string, appProperties: Record<string, string>, data: Uint8Array): StoredFile {
		const f = { id: `d${this.next++}`, name, appProperties, data };
		this.files.set(f.id, f);
		this.log.push({ id: f.id, removed: false });
		return f;
	}

	private meta(f: StoredFile) {
		return { id: f.id, name: f.name, appProperties: f.appProperties, size: String(f.data.length) };
	}
}
