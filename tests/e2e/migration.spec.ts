import { expect, test } from '@playwright/test';
import { createBoard, el, enableTestHooks, waitForHooks } from './helpers';

// Data saved while the app was called SMTHNG: made here with the app, then moved under the old
// database and settings names, as an older version left it.
test('boards and settings saved under the old name SMTHNG are copied over', async ({ page }) => {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await page.getByRole('button', { name: /Rename board/ }).click();
	await page.getByRole('textbox', { name: 'Board title' }).fill('From SMTHNG');
	await page.keyboard.press('Enter');
	await page.evaluate((e) => window.__spacy!.createElements([e as never]), {
		...el.shape('n', -100, -100),
		type: 'sticky',
		kind: undefined,
		text: 'Still here',
		color: '#ffe066',
		w: 200,
		h: 200
	});
	await expect(page.getByText('Saved locally')).toBeVisible();

	// A static file: no app code holds the databases open while they're renamed.
	await page.goto('/favicon.svg');
	await page.evaluate(async () => {
		const done = <T>(req: IDBRequest<T>) =>
			new Promise<T>((resolve, reject) => {
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
			});
		const finished = (tx: IDBTransaction) =>
			new Promise<void>((resolve, reject) => {
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			});
		async function rename(from: string, to: string) {
			const src = await done(indexedDB.open(from));
			const names = [...src.objectStoreNames];
			const read = src.transaction(names);
			const stores = await Promise.all(
				names.map(async (name) => {
					const store = read.objectStore(name);
					return {
						name,
						keyPath: store.keyPath,
						autoIncrement: store.autoIncrement,
						indexes: [...store.indexNames].map((i) => [i, store.index(i).keyPath] as const),
						keys: await done(store.getAllKeys()),
						values: await done(store.getAll())
					};
				})
			);
			const open = indexedDB.open(to, src.version);
			src.close();
			open.onupgradeneeded = () => {
				for (const s of stores) {
					const store = open.result.createObjectStore(s.name, s);
					for (const [name, keyPath] of s.indexes) store.createIndex(name, keyPath);
				}
			};
			const dst = await done(open);
			const write = dst.transaction(names, 'readwrite');
			for (const s of stores)
				s.values.forEach((v, i) =>
					s.keyPath === null
						? write.objectStore(s.name).put(v, s.keys[i])
						: write.objectStore(s.name).put(v)
				);
			await finished(write);
			dst.close();
			await done(indexedDB.deleteDatabase(from));
		}
		for (const { name } of await indexedDB.databases())
			if (name?.startsWith('spacy')) await rename(name, name.replace(/^spacy/, 'smthng'));

		localStorage.clear();
		localStorage.setItem('smthng:theme', '"dark"');
		localStorage.setItem('smthng:home:layout', '"list"');
		localStorage.setItem('smthng:onboarded', 'true');
		localStorage.setItem('smthng:testHooks', 'true');
	});

	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await expect(page.getByRole('button', { name: 'List view' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.getByRole('link', { name: 'Open From SMTHNG' }).click();
	await waitForHooks(page);
	await expect
		.poll(() => page.evaluate(() => window.__spacy!.list().map((e) => e.id)))
		.toEqual(['n']);

	// The old data is kept for an older version that may still use it.
	const names = await page.evaluate(async () =>
		(await indexedDB.databases()).map((d) => d.name ?? '').sort()
	);
	expect(names.filter((n) => n.startsWith('smthng'))).toHaveLength(2);
	expect(names.filter((n) => n.startsWith('spacy'))).toHaveLength(2);
});
