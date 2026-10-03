import { writeFile } from 'node:fs/promises';
import { test, type CDPSession, type Page } from '@playwright/test';
import { createBoard, el, enableTestHooks, waitForHooks, waitForInitialView } from './helpers';

// Measurements, not assertions: run with `pnpm bench`. Results are printed and attached as JSON.
test.skip(!process.env.PERF, 'benchmarks run only with PERF=1 (pnpm bench)');
test.skip(({ browserName }) => browserName !== 'chromium', 'measured in Chromium');
test.setTimeout(180_000);

const FRAMES = 60;
const STEP = 4; // screen px per frame

interface Result {
	scenario: string;
	frames: number;
	fps: number;
	p95: number;
	/** Main-thread work per frame (ms), from the DevTools Performance domain. */
	script: number;
	style: number;
	layout: number;
	task: number;
	/** Instrumented app code per frame (ms). */
	apply: number;
	read: number;
	reads: number;
	cull: number;
	/** Y.Doc updates (= IndexedDB writes and tab broadcasts) during the gesture, and their size. */
	updates: number;
	kb: number;
}

const results: Result[] = [];

test.afterAll(async () => {
	if (results.length === 0) return;
	const cols = Object.keys(results[0]!) as (keyof Result)[];
	const fmt = (v: unknown) => (typeof v === 'number' ? String(Math.round(v * 10) / 10) : String(v));
	console.log(
		['', cols.join(' | '), cols.map(() => '---').join(' | '), '']
			.concat(results.map((r) => cols.map((c) => fmt(r[c])).join(' | ')))
			.join('\n')
	);
	await test.info().attach('perf-bench.json', {
		body: JSON.stringify(results, null, 2),
		contentType: 'application/json'
	});
});

async function openPerfBoard(page: Page, n = 3000): Promise<void> {
	await enableTestHooks(page);
	await createBoard(page);
	await waitForHooks(page);
	await waitForInitialView(page);
	if (n > 0) await page.evaluate((k) => window.__smthng!.perfMixed(k), n);
	await page.waitForTimeout(500); // let image and doc card views settle
}

async function setView(page: Page, center: { x: number; y: number }, zoom: number) {
	await page.evaluate(
		({ center, zoom }) => {
			const v = window.__smthng!.ctx.viewport;
			v.set({
				zoom,
				x: v.size.w / 2 - center.x * zoom,
				y: v.size.h / 2 - center.y * zoom
			});
		},
		{ center, zoom }
	);
	await page.waitForTimeout(300);
}

const nextFrame = (page: Page) =>
	page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())));

/** Starts recording frame times, hot-path timings and doc updates in `page`. */
async function startRecording(page: Page) {
	await page.evaluate(() => {
		const hooks = window.__smthng!;
		hooks.timings.clear();
		const rec = { stamps: [] as number[], updates: 0, bytes: 0, running: true };
		const tick = (t: number) => {
			rec.stamps.push(t);
			if (rec.running) requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
		const onUpdate = (u: Uint8Array) => {
			rec.updates++;
			rec.bytes += u.byteLength;
		};
		hooks.ctx.doc.on('update', onUpdate);
		(window as unknown as { __bench: unknown }).__bench = {
			rec,
			stop: () => {
				rec.running = false;
				hooks.ctx.doc.off('update', onUpdate);
			}
		};
	});
}

async function stopRecording(page: Page) {
	return page.evaluate(() => {
		const bench = (
			window as unknown as {
				__bench: { rec: { stamps: number[]; updates: number; bytes: number }; stop(): void };
			}
		).__bench;
		bench.stop();
		const t = (name: string) => window.__smthng!.timings.get(name) ?? { ms: 0, calls: 0 };
		return {
			stamps: bench.rec.stamps,
			updates: bench.rec.updates,
			bytes: bench.rec.bytes,
			apply: t('store.apply').ms,
			read: t('store.read').ms,
			reads: t('store.read').calls,
			cull: t('layer.cull').ms
		};
	});
}

type Metrics = Record<string, number>;
async function metrics(cdp: CDPSession): Promise<Metrics> {
	const { metrics } = await cdp.send('Performance.getMetrics');
	return Object.fromEntries(metrics.map((m) => [m.name, m.value]));
}

/**
 * Measures `drive` (which should produce about FRAMES frames of work) on `observed`:
 * frame times, main-thread time split, instrumented app time and doc updates.
 */
async function measure(
	scenario: string,
	observed: Page,
	drive: () => Promise<void>
): Promise<Result> {
	const cdp = await observed.context().newCDPSession(observed);
	await cdp.send('Performance.enable');
	// PROFILE=1 also saves a CPU profile per scenario (open it in DevTools → Performance).
	const profiling = !!process.env.PROFILE;
	if (profiling) {
		await cdp.send('Profiler.enable');
		await cdp.send('Profiler.start');
	}
	await nextFrame(observed);
	await startRecording(observed);
	const m0 = await metrics(cdp);
	await drive();
	await nextFrame(observed);
	const m1 = await metrics(cdp);
	const rec = await stopRecording(observed);
	if (profiling) {
		const { profile } = await cdp.send('Profiler.stop');
		const file = test.info().outputPath(`${scenario.replace(/\W+/g, '-')}.cpuprofile`);
		await writeFile(file, JSON.stringify(profile));
		console.log(`profile: ${file}`);
	}
	await cdp.detach();

	const deltas = rec.stamps.slice(1).map((t, i) => t - rec.stamps[i]!);
	const frames = Math.max(1, deltas.length);
	const total = deltas.reduce((a, b) => a + b, 0);
	const sorted = [...deltas].sort((a, b) => a - b);
	const per = (key: string) => (((m1[key] ?? 0) - (m0[key] ?? 0)) * 1000) / frames;
	const r: Result = {
		scenario,
		frames,
		fps: (frames * 1000) / Math.max(1, total),
		p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
		script: per('ScriptDuration'),
		style: per('RecalcStyleDuration'),
		layout: per('LayoutDuration'),
		task: per('TaskDuration'),
		apply: rec.apply / frames,
		read: rec.read / frames,
		reads: rec.reads / frames,
		cull: rec.cull / frames,
		updates: rec.updates,
		kb: rec.bytes / 1024
	};
	results.push(r);
	console.log(JSON.stringify(r));
	return r;
}

/** A pointer drag of FRAMES steps, one per frame of `paced`. */
async function drag(driver: Page, from: { x: number; y: number }, paced: Page = driver) {
	await driver.mouse.move(from.x, from.y);
	await driver.mouse.down();
	for (let i = 1; i <= FRAMES; i++) {
		await driver.mouse.move(from.x + i * STEP, from.y + (i * STEP) / 2);
		await nextFrame(paced);
	}
	await driver.mouse.up();
}

async function centerOf(page: Page, selector: string) {
	const box = await page.locator(selector).first().boundingBox();
	if (!box) throw new Error(`${selector} is not rendered`);
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Puts a grab handle on top at world (0, 0) and selects it plus the `n` elements nearest to it. */
async function selectAroundOrigin(page: Page, n: number): Promise<number> {
	await page.evaluate(
		(e) => window.__smthng!.createElements([e as never]),
		el.shape('grab', -80, -50)
	);
	return page.evaluate((n) => {
		const { store, selection } = window.__smthng!.ctx;
		const ids = store.index
			.search({ x: -3000, y: -3000, w: 6000, h: 6000 })
			.filter((id) => {
				const t = store.get(id)?.type;
				return id !== 'grab' && t !== 'connector' && t !== 'frame';
			})
			.map((id) => {
				const r = store.index.get(id)!;
				return { id, d: Math.hypot(r.x + r.w / 2, r.y + r.h / 2) };
			})
			.sort((a, b) => a.d - b.d)
			.slice(0, n)
			.map((x) => x.id);
		selection.set([...ids, 'grab']);
		return ids.length + 1;
	}, n);
}

test('pan', async ({ page }) => {
	await openPerfBoard(page);
	for (const zoom of [1, 0.5, 0.1]) {
		await setView(page, { x: 0, y: 0 }, zoom);
		await measure(`pan @ ${zoom * 100}%`, page, async () => {
			for (let i = 0; i < FRAMES; i++) {
				await page.evaluate(() => {
					const v = window.__smthng!.ctx.viewport;
					v.set({ ...v.vp, x: v.vp.x + 5 });
				});
				await nextFrame(page);
			}
		});
	}
});

test('drag 1 of 3k', async ({ page }) => {
	await openPerfBoard(page);
	await page.evaluate(
		(e) => window.__smthng!.createElements([e as never]),
		el.shape('grab', -80, -50)
	);
	await setView(page, { x: 0, y: 0 }, 1);
	const from = await centerOf(page, '[data-element-id="grab"]');
	await measure('drag 1 of 3k @ 100%', page, () => drag(page, from));
});

for (const n of [100, 300]) {
	test(`drag ${n} selected`, async ({ page }) => {
		await openPerfBoard(page);
		await setView(page, { x: 0, y: 0 }, 0.5);
		const count = await selectAroundOrigin(page, n - 1);
		await nextFrame(page);
		const from = await centerOf(page, '[data-element-id="grab"]');
		await measure(`drag ${count} selected @ 50%`, page, () => drag(page, from));
	});
}

test('move a frame with 200 children', async ({ page }) => {
	await openPerfBoard(page);
	// Far from the generated content, so nothing covers the frame's title.
	const fx = 20_000;
	const fy = 20_000;
	await page.evaluate(
		({ frame, children }) => window.__smthng!.createElements([frame, ...children] as never),
		{
			frame: {
				...el.shape('bench-frame', fx, fy),
				type: 'frame',
				w: 2000,
				h: 1400,
				title: 'Bench'
			},
			children: Array.from({ length: 200 }, (_, i) =>
				el.shape(`child-${i}`, fx + 40 + (i % 20) * 95, fy + 60 + Math.floor(i / 20) * 130, {
					parentId: 'bench-frame',
					w: 80,
					h: 60
				})
			)
		}
	);
	await setView(page, { x: fx + 1000, y: fy + 700 }, 0.35);
	const title = await centerOf(page, '[data-element-id="bench-frame"] [data-frame-title]');
	await measure('frame + 200 children @ 35%', page, () => drag(page, title));
	const moved = await page.evaluate(() => window.__smthng!.ctx.store.get('child-0')!.x);
	if (moved === fx + 40) throw new Error('the frame drag did not move its children');
});

test('drag 300 selected in another tab', async ({ page, context }) => {
	await openPerfBoard(page);
	const other = await context.newPage();
	await other.goto(page.url());
	await waitForHooks(other);
	await other.waitForFunction(() => window.__smthng!.ctx.store.elements.size > 2900);
	await other.waitForTimeout(500);
	await setView(page, { x: 0, y: 0 }, 0.5);
	await setView(other, { x: 0, y: 0 }, 0.5);
	const count = await selectAroundOrigin(other, 299);
	await other.waitForFunction(() => window.__smthng!.ctx.store.get('grab'));
	await page.waitForFunction(() => window.__smthng!.ctx.store.get('grab'));
	const from = await centerOf(other, '[data-element-id="grab"]');
	await measure(`remote: ${count} dragged in the other tab`, page, () => drag(other, from, other));
});
