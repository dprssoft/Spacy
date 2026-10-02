// `pnpm fixtures`: regenerates the e2e fixture files from code (never edit them by hand).
// Loads app modules through Vite so the `$lib` aliases and TypeScript work as in the app.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const server = await createServer({
	server: { middlewareMode: true },
	appType: 'custom',
	logLevel: 'error'
});
try {
	const { buildVisualBoardFile } = await server.ssrLoadModule('/src/lib/dev/visualFixture.ts');
	mkdirSync('tests/e2e/fixtures', { recursive: true });
	const file = 'tests/e2e/fixtures/visual-board.smthng';
	const png = readFileSync('tests/e2e/fixtures/sample.png');
	// PNG header: width and height are big-endian at bytes 16 and 20.
	const image = {
		base64: png.toString('base64'),
		width: png.readUInt32BE(16),
		height: png.readUInt32BE(20)
	};
	writeFileSync(file, buildVisualBoardFile(image));
	console.log(`Wrote ${file}`);
} finally {
	await server.close();
}
