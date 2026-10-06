// Serves ./build like a static host (Cloudflare Pages / Netlify): files, the SPA fallback from
// _redirects, and the response headers from _headers. Used by the e2e tests so they run against
// the production output under the production Content-Security-Policy. Text is compressed like
// those hosts do, so performance measurements against it are realistic.
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { constants, createBrotliCompress, createGzip } from 'node:zlib';

const ROOT = 'build';
const port = Number(process.argv[2] ?? 4173);
const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json',
	'.webmanifest': 'application/manifest+json',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.ico': 'image/x-icon',
	'.webp': 'image/webp',
	'.woff2': 'font/woff2',
	'.txt': 'text/plain; charset=utf-8'
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.txt']);

/** `_headers`: a path pattern line, then indented `Name: value` lines. */
function parseHeaders(text) {
	const rules = [];
	for (const line of text.split('\n')) {
		if (!line.trim() || line.trim().startsWith('#')) continue;
		if (!/^\s/.test(line)) rules.push({ pattern: line.trim(), headers: [] });
		else {
			const i = line.indexOf(':');
			rules.at(-1)?.headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
		}
	}
	return rules;
}
const matches = (pattern, path) =>
	pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern;

const rules = parseHeaders(readFileSync(join(ROOT, '_headers'), 'utf8'));
// `_redirects`: the catch-all rewrite (`/*  /200.html  200`) names the SPA fallback page.
const rewrite = readFileSync(join(ROOT, '_redirects'), 'utf8')
	.split('\n')
	.map((line) => line.trim().split(/\s+/))
	.find(([from, , status]) => from === '/*' && status === '200');
if (!rewrite?.[1]) throw new Error('_redirects: no catch-all 200 rewrite');
const FALLBACK = join(ROOT, rewrite[1]);

createServer((req, res) => {
	const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
	let file = normalize(join(ROOT, path));
	if (!file.startsWith(ROOT)) file = FALLBACK;
	if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
	// SPA fallback, but a missing asset is a real 404.
	let status = 200;
	if (!existsSync(file)) {
		if (extname(path)) status = 404;
		file = FALLBACK;
	}
	for (const rule of rules)
		if (matches(rule.pattern, path)) for (const [k, v] of rule.headers) res.setHeader(k, v);
	res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
	const accept = String(req.headers['accept-encoding'] ?? '');
	const encoding = !COMPRESSIBLE.has(extname(file))
		? null
		: /\bbr\b/.test(accept)
			? 'br'
			: /\bgzip\b/.test(accept)
				? 'gzip'
				: null;
	if (encoding && status !== 404) {
		res.setHeader('Content-Encoding', encoding);
		res.setHeader('Vary', 'Accept-Encoding');
	}
	res.writeHead(status);
	if (status === 404) return res.end('Not found');
	const body = createReadStream(file);
	// Quality 5, like hosts' on-the-fly compression (the default, 11, takes seconds per file).
	if (encoding === 'br')
		body.pipe(createBrotliCompress({ params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })).pipe(res);
	else if (encoding === 'gzip') body.pipe(createGzip()).pipe(res);
	else body.pipe(res);
}).listen(port, () => console.log(`Serving ${ROOT}/ on http://localhost:${port}`));
