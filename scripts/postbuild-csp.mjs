// After `vite build`: allow exactly the inline scripts of the built page in the CSP.
// SvelteKit's bootstrap script is inline and changes with every build, so its hash is added to
// `script-src` in build/_headers (the source file static/_headers keeps the plain `'self'`).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('build/index.html', 'utf8');
const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
	(m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`
);
const headers = readFileSync('build/_headers', 'utf8');
if (!headers.includes("script-src 'self';"))
	throw new Error("_headers: script-src 'self' not found");
writeFileSync(
	'build/_headers',
	headers.replace("script-src 'self';", `script-src 'self' ${[...new Set(hashes)].join(' ')};`)
);
console.log(`CSP: allowed ${hashes.length} inline script(s) by hash`);
