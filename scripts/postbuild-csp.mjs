// After `vite build`: allow exactly the inline scripts of the built pages in the CSP (the
// prerendered start page and the SPA fallback). SvelteKit's bootstrap script is inline and changes
// with every build, so the hashes are added to `script-src` in build/_headers (the source file
// static/_headers keeps the plain `'self'`).
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

// The same PUBLIC_* settings the build used (vite.config.ts): the environment, else .env files.
const fileEnv = Object.fromEntries(
	['.env', '.env.local', '.env.production', '.env.production.local']
		.filter((f) => existsSync(f))
		.flatMap((f) => readFileSync(f, 'utf8').split('\n'))
		.map((l) => /^\s*(PUBLIC_\w+)\s*=\s*(.*?)\s*$/.exec(l))
		.filter((m) => m !== null)
		.map((m) => [m[1], m[2].replace(/^(['"])(.*)\1$/, '$2')])
);
const env = { ...fileEnv, ...process.env };

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
// Live sharing relays (PUBLIC_SIGNALING_URLS, see relay/README.md) are the only other servers the
// app connects to.
const relays = (env.PUBLIC_SIGNALING_URLS ?? '')
	.split(',')
	.map((u) => u.trim())
	.filter((u) => /^wss?:\/\/[^\s;']+$/.test(u))
	.map((u) => new URL(u).origin);
// Google Drive sync (PUBLIC_GOOGLE_CLIENT_ID): Google's sign-in script and popup, and the Drive API.
const google = (env.PUBLIC_GOOGLE_CLIENT_ID ?? '').trim() !== '';
const connect = ["'self'", ...new Set(relays)];
if (google) connect.push('https://www.googleapis.com', 'https://oauth2.googleapis.com');
if (!headers.includes("connect-src 'self';"))
	throw new Error("_headers: connect-src 'self' not found");
writeFileSync(
	'build/_headers',
	headers
		.replace(
			"script-src 'self';",
			`script-src 'self'${google ? ' https://accounts.google.com/gsi/client' : ''} ${[...new Set(hashes)].join(' ')};`
		)
		.replace("connect-src 'self';", `connect-src ${connect.join(' ')};`)
		.replace(
			"style-src 'self' 'unsafe-inline';",
			`style-src 'self' 'unsafe-inline'${google ? ' https://accounts.google.com/gsi/style' : ''};`
		)
		.replace('frame-src ', `frame-src ${google ? 'https://accounts.google.com ' : ''}`)
);
if (google) console.log('CSP: Google sign-in and Drive API allowed');
if (relays.length) console.log(`CSP: live sharing relays ${relays.join(', ')}`);
console.log(`CSP: allowed ${new Set(hashes).size} inline script(s) by hash in ${pages.join(', ')}`);
