// After `vite build`: allow exactly the inline scripts of the built pages in the CSP (the
// prerendered start page and the SPA fallback). SvelteKit's bootstrap script is inline and changes
// with every build, so the hashes are added to `script-src` in build/_headers (the source file
// static/_headers keeps the plain `'self'`).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const pages = readdirSync('build').filter((f) => f.endsWith('.html'));
const hashes = pages.flatMap((page) =>
	[
		...readFileSync(`build/${page}`, 'utf8').matchAll(
			/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g
		)
	].map((m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`)
);
const headers = readFileSync('build/_headers', 'utf8');
if (!headers.includes("script-src 'self';"))
	throw new Error("_headers: script-src 'self' not found");
writeFileSync(
	'build/_headers',
	headers.replace("script-src 'self';", `script-src 'self' ${[...new Set(hashes)].join(' ')};`)
);
console.log(`CSP: allowed ${new Set(hashes).size} inline script(s) by hash in ${pages.join(', ')}`);
