import * as Y from 'yjs';
import { baseStyleFor, STICKY_COLORS } from '$lib/model/defaults';
import { getDocsMap } from '$lib/model/doc';
import { createElements } from '$lib/model/ops';
import type { NewElement, Routing, ShapeKind } from '$lib/model/types';
import * as assetsRepo from '$lib/storage/assetsRepo';

/** Deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const KINDS: ShapeKind[] = ['rect', 'ellipse', 'diamond'];
const STICKIES = Object.values(STICKY_COLORS);
const FILLS = ['#ffffff', '#a5d8ff', '#b2f2bb', '#ffec99', '#ffc9c9', '#d0bfff'];

/** Shapes, stickies and texts spread over a 10,000 × 10,000 area, for performance testing. */
export function generatePerfElements(n = 3000, seed = 1): NewElement[] {
	const r = rng(seed);
	const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
	const out: NewElement[] = [];
	for (let i = 0; i < n; i++) {
		const x = r() * 10_000 - 5000;
		const y = r() * 10_000 - 5000;
		const base = {
			id: `perf-${seed}-${i}`,
			x,
			y,
			rotation: r() < 0.1 ? (r() - 0.5) * 0.6 : 0,
			parentId: null,
			groupId: null,
			locked: false
		};
		const roll = r();
		if (roll < 0.5) {
			const style = { ...baseStyleFor('shape'), fill: pick(FILLS) };
			out.push({
				...base,
				type: 'shape',
				kind: pick(KINDS),
				w: 80 + r() * 160,
				h: 60 + r() * 100,
				text: r() < 0.5 ? `Shape ${i}` : '',
				style
			});
		} else if (roll < 0.8) {
			out.push({
				...base,
				type: 'sticky',
				w: 200,
				h: 200,
				color: pick(STICKIES),
				text: `Idea #${i}\nSome notes here`,
				style: baseStyleFor('sticky')
			});
		} else {
			out.push({
				...base,
				type: 'text',
				w: 160,
				h: 24,
				autoWidth: true,
				text: `Label ${i}`,
				style: baseStyleFor('text')
			});
		}
	}
	return out;
}

const ROUTINGS: Routing[] = ['straight', 'elbow', 'curve'];
const PARAGRAPHS = [
	'Notes from the planning session, with enough words to wrap over a couple of lines.',
	'Open questions and risks that still need an owner before the next review.',
	'Next steps, in the order we agreed to take them.'
];

async function tinyImage(): Promise<Blob> {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = 64;
	const c = canvas.getContext('2d');
	if (c) {
		c.fillStyle = '#a5d8ff';
		c.fillRect(0, 0, 64, 64);
		c.fillStyle = '#1971c2';
		c.fillRect(16, 16, 32, 32);
	}
	return new Promise((resolve) =>
		canvas.toBlob((b) => resolve(b ?? new Blob([], { type: 'image/png' })), 'image/png')
	);
}

/**
 * A realistic board for performance testing. Of `n` elements: 60 % shapes/stickies/texts, 10 %
 * strokes (~80 points), doc cards with three paragraphs, frames, images sharing one asset, and
 * ~27 % connectors between nearby elements in all three routings. Returns the number created.
 */
export async function createMixedPerfBoard(
	doc: Y.Doc,
	boardId: string,
	n = 3000,
	seed = 1
): Promise<number> {
	const r = rng(seed + 1000);
	const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
	const share = (per3000: number) => Math.max(1, Math.round((per3000 * n) / 3000));
	const pos = () => ({ x: r() * 10_000 - 5000, y: r() * 10_000 - 5000 });
	const base = (id: string) => ({
		id,
		...pos(),
		rotation: 0,
		parentId: null,
		groupId: null,
		locked: false
	});

	const els: NewElement[] = generatePerfElements(share(1800), seed).map((e) => ({
		...e,
		id: `mix-${e.id}`
	}));
	for (let i = 0; i < share(300); i++) {
		const points: number[] = [];
		let x = 0;
		let y = 60;
		for (let k = 0; k < 80; k++) {
			x += 3 + r() * 4;
			y += (r() - 0.5) * 14;
			points.push(x, y, 0.5);
		}
		els.push({
			...base(`mix-stroke-${seed}-${i}`),
			type: 'stroke',
			w: x,
			h: 120,
			points,
			style: baseStyleFor('stroke')
		});
	}
	const cards: string[] = [];
	for (let i = 0; i < share(50); i++) {
		const id = `mix-doc-${seed}-${i}`;
		cards.push(id);
		els.push({
			...base(id),
			type: 'doccard',
			w: 360,
			h: 280,
			title: `Doc ${i}`,
			collapsed: false,
			expandedH: 280,
			style: baseStyleFor('doccard')
		});
	}
	for (let i = 0; i < share(20); i++)
		els.push({
			...base(`mix-frame-${seed}-${i}`),
			type: 'frame',
			w: 700,
			h: 500,
			title: `Frame ${i}`,
			style: baseStyleFor('frame')
		});
	const assetId = await assetsRepo.put(boardId, await tinyImage(), { width: 64, height: 64 });
	for (let i = 0; i < share(30); i++)
		els.push({
			...base(`mix-img-${seed}-${i}`),
			type: 'image',
			w: 160,
			h: 160,
			assetId,
			naturalW: 64,
			naturalH: 64,
			style: baseStyleFor('image')
		});

	// Connectors between elements that are close to each other (a coarse grid of buckets).
	const CELL = 700;
	const buckets = new Map<string, NewElement[]>();
	const targets = els.filter((e) => e.type !== 'frame');
	for (const e of targets) {
		const key = `${Math.floor(e.x / CELL)}:${Math.floor(e.y / CELL)}`;
		buckets.set(key, [...(buckets.get(key) ?? []), e]);
	}
	const near = [...buckets.values()].filter((b) => b.length >= 2);
	const connectorStyle = baseStyleFor('connector');
	for (let i = 0; i < share(800) && near.length > 0; i++) {
		const bucket = pick(near);
		const a = pick(bucket);
		let b = pick(bucket);
		if (b === a) b = bucket[(bucket.indexOf(a) + 1) % bucket.length]!;
		const end = (e: NewElement) => ({
			kind: 'float' as const,
			elementId: e.id,
			lastX: e.x + e.w / 2,
			lastY: e.y + e.h / 2
		});
		els.push({
			id: `mix-conn-${seed}-${i}`,
			type: 'connector',
			x: 0,
			y: 0,
			w: 0,
			h: 0,
			rotation: 0,
			parentId: null,
			groupId: null,
			locked: false,
			style: connectorStyle,
			from: end(a),
			to: end(b),
			routing: ROUTINGS[i % ROUTINGS.length]!,
			waypoints: [],
			markerStart: 'none',
			markerEnd: 'arrow',
			label: { text: i % 10 === 0 ? `link ${i}` : '', t: 0.5, background: true }
		});
	}

	doc.transact(() => {
		createElements(doc, els);
		const docs = getDocsMap(doc);
		for (const id of cards) {
			const frag = docs.get(id);
			if (!frag) continue;
			frag.insert(
				0,
				PARAGRAPHS.map((text) => {
					const p = new Y.XmlElement('paragraph');
					p.insert(0, [new Y.XmlText(text)]);
					return p;
				})
			);
		}
	});
	return els.length;
}
