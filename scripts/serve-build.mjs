// Serves ./build like a static host (Cloudflare Pages / Netlify): files, the SPA fallback from
// _redirects, and the response headers from _headers. Used by the e2e tests so they run against
// the production output under the production Content-Security-Policy.
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

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

createServer((req, res) => {
	const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
	let file = normalize(join(ROOT, path));
	if (!file.startsWith(ROOT)) file = join(ROOT, 'index.html');
	if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
	// SPA fallback (`/*  /index.html  200`), but a missing asset is a real 404.
	let status = 200;
	if (!existsSync(file)) {
		if (extname(path)) status = 404;
		file = join(ROOT, 'index.html');
	}
	for (const rule of rules)
		if (matches(rule.pattern, path)) for (const [k, v] of rule.headers) res.setHeader(k, v);
	res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
	res.writeHead(status);
	if (status === 404) return res.end('Not found');
	createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Serving ${ROOT}/ on http://localhost:${port}`));
