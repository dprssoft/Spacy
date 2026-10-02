// The board used by the visual regression test: every element type, all routings and markers.
// Built by `pnpm fixtures` (scripts/make-fixtures.ts) into tests/e2e/fixtures/visual-board.smthng.
import * as Y from 'yjs';
import { baseStyleFor, STICKY_COLORS } from '$lib/model/defaults';
import { getDocsMap } from '$lib/model/doc';
import { migrate } from '$lib/model/migrations';
import { addSketchStroke, createElements } from '$lib/model/ops';
import { TEMPLATE } from '$lib/model/origins';
import type { Marker, NewElement } from '$lib/model/types';
import { bytesToBase64 } from '$lib/shared/base64';
import type { SketchStroke } from '$lib/board/sketch/brushes';
import { firstFrame, growFrame } from '$lib/board/sketch/geometry';
import { TemplateBuilder } from '$lib/templates/builder';

const ASSET_ID = 'visual-asset';

const el = (
	tag: string,
	attrs: Record<string, unknown>,
	...children: (Y.XmlElement | string)[]
) => {
	const node = new Y.XmlElement(tag);
	for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v as string);
	node.insert(
		0,
		children.map((c) => (typeof c === 'string' ? new Y.XmlText(c) : c))
	);
	return node;
};

export function buildVisualBoard(): Y.Doc {
	const doc = new Y.Doc();
	doc.clientID = 1; // stable output
	migrate(doc);
	const b = new TemplateBuilder();

	const frame = b.frame('Frame', { x: -540, y: -290, w: 620, h: 250 });
	const inFrame = { parent: frame };
	const blue = { fill: '#a5d8ff', stroke: '#1971c2' };
	const start = b.shape('terminator', { x: -520, y: -260, w: 130, h: 56 }, 'Start', inFrame);
	const step = b.shape('process', { x: -340, y: -265, w: 140, h: 66 }, 'Process', {
		...inFrame,
		style: blue
	});
	const ok = b.shape('decision', { x: -150, y: -275, w: 150, h: 86 }, 'OK?', {
		...inFrame,
		style: { fill: '#ffec99', stroke: '#f59f00' }
	});
	const data = b.shape('data', { x: -520, y: -150, w: 130, h: 60 }, 'Data', inFrame);
	const docShape = b.shape('document', { x: -340, y: -150, w: 140, h: 70 }, 'Document', inFrame);
	const db = b.shape('database', { x: -150, y: -160, w: 110, h: 90 }, 'DB', inFrame);

	// Basic shapes with the style variants.
	b.shape('rect', { x: 120, y: -290, w: 120, h: 70 }, 'Dashed', {
		style: { fillStyle: 'none', dash: 'dashed', strokeWidth: 2 }
	});
	b.shape('ellipse', { x: 260, y: -290, w: 120, h: 70 }, 'Semi', {
		style: { fill: '#b2f2bb', stroke: '#2f9e44', fillStyle: 'semi', strokeWidth: 4 }
	});
	b.shape('diamond', { x: 400, y: -295, w: 110, h: 80 }, 'Bold', {
		style: { fill: '#ffc9c9', stroke: '#e03131', font: { bold: true, italic: true } }
	});
	b.shape('cloud', { x: 120, y: -200, w: 130, h: 80 }, 'Cloud');
	b.shape('actor', { x: 290, y: -200, w: 60, h: 90 }, '');
	b.text({ x: 380, y: -190, w: 150, h: 60 }, 'Wrapped text on the canvas', {
		font: { align: 'l', size: 'm' }
	});

	const sticky = b.sticky({ x: -540, y: -10, w: 150, h: 150 }, 'Sticky note', STICKY_COLORS.yellow);
	const sticky2 = b.sticky({ x: -360, y: -10, w: 150, h: 150 }, 'Another', STICKY_COLORS.violet);
	const card = b.docCard({ x: 120, y: -80, w: 320, h: 240 }, 'Doc card');

	// One connector per routing between real elements, with labels.
	b.connect(start, 'e', step, 'w', { routing: 'straight' });
	b.connect(step, 'e', ok, 'w', { routing: 'straight', label: 'next' });
	b.connect(ok, 's', db, 'n', { routing: 'elbow', label: 'yes' });
	b.connect(data, 'e', docShape, 'w', { routing: 'curve', markerStart: 'circle' });
	b.connect(sticky, 'e', sticky2, 'w', { routing: 'curve', markerEnd: 'openArrow' });
	b.connect(sticky2, 'e', card, 'w', { routing: 'elbow', label: 'notes', markerEnd: 'triangle' });

	const extra: NewElement[] = [];
	// Every marker, as free connectors in a column.
	const MARKERS: Marker[] = ['none', 'arrow', 'openArrow', 'triangle', 'diamond', 'circle', 'bar'];
	MARKERS.forEach((marker, i) => {
		const y = -20 + i * 26;
		const c = b.connect(start, 'float', step, 'float', {
			routing: 'straight',
			markerStart: marker,
			markerEnd: marker
		});
		c.from = { kind: 'free', x: -170, y };
		c.to = { kind: 'free', x: 60, y };
	});
	extra.push(
		{
			id: 'visual-image',
			type: 'image',
			x: -540,
			y: 170,
			w: 150,
			h: 100,
			rotation: 0,
			parentId: null,
			groupId: null,
			locked: false,
			assetId: ASSET_ID,
			naturalW: 2,
			naturalH: 2,
			style: {
				...b.elements[0]!.style,
				fill: 'transparent',
				fillStyle: 'none',
				stroke: '#1e1e1e',
				radius: 'sm',
				shadow: false
			}
		},
		{
			id: 'visual-stroke',
			type: 'stroke',
			x: -350,
			y: 190,
			w: 220,
			h: 70,
			rotation: 0,
			parentId: null,
			groupId: null,
			locked: false,
			points: [
				0, 40, 0.5, 30, 5, 0.5, 70, 60, 0.5, 110, 10, 0.5, 150, 55, 0.5, 190, 20, 0.5, 220, 45, 0.5
			],
			style: {
				...b.elements[0]!.style,
				fill: 'transparent',
				fillStyle: 'none',
				stroke: '#1e1e1e',
				strokeWidth: 4
			}
		},
		{
			id: 'visual-rotated',
			type: 'shape',
			kind: 'rect',
			text: 'Rotated',
			x: 470,
			y: 40,
			w: 110,
			h: 60,
			rotation: 0.35,
			parentId: null,
			groupId: null,
			locked: false,
			style: { ...start.style, shadow: true }
		}
	);

	doc.transact(() => {
		b.commit(doc);
		createElements(doc, extra, TEMPLATE);
		// A sketch: one object with a stroke of each brush and an eraser pass.
		const wavy = (y: number) => {
			const p: number[] = [];
			for (let x = 150; x <= 420; x += 15)
				p.push(x, y + Math.sin(x / 30) * 8, 0.2 + ((x - 150) / 270) * 0.7);
			return p;
		};
		const strokes: SketchStroke[] = [
			{ b: 'pen', c: '#1e1e1e', s: 8, p: wavy(200) },
			{ b: 'pencil', c: '#1971c2', s: 8, p: wavy(222) },
			{ b: 'marker', c: '#e03131', s: 6, p: wavy(244) },
			{ b: 'highlighter', c: '#f59f00', s: 6, p: wavy(266) },
			{ b: 'eraser', c: '#000000', s: 6, p: [300, 185, 0.5, 300, 285, 0.5] }
		];
		let frame = firstFrame(strokes[0]!);
		for (const s of strokes.slice(0, 4)) frame = growFrame(frame, s) ?? frame;
		strokes.forEach((stroke, i) =>
			addSketchStroke(
				doc,
				{
					id: 'visual-sketch',
					stroke,
					create:
						i === 0
							? {
									id: 'visual-sketch',
									type: 'sketch',
									rotation: 0,
									parentId: null,
									groupId: null,
									locked: false,
									style: baseStyleFor('sketch'),
									...frame
								}
							: undefined
				},
				TEMPLATE
			)
		);
		getDocsMap(doc)
			.get(card.id)!
			.insert(0, [
				el('heading', { level: 2 }, 'Heading'),
				el('paragraph', {}, 'A paragraph of body text in the card.'),
				el(
					'taskList',
					{},
					el('taskItem', { checked: true }, el('paragraph', {}, 'Done')),
					el('taskItem', { checked: false }, el('paragraph', {}, 'To do'))
				),
				el('blockquote', {}, el('paragraph', {}, 'A quote'))
			]);
	}, TEMPLATE);
	return doc;
}

/** The fixture as `.smthng` file content. */
export function buildVisualBoardFile(image: {
	base64: string;
	width: number;
	height: number;
}): string {
	const doc = buildVisualBoard();
	return JSON.stringify({
		format: 'smthng',
		version: 1,
		kind: 'board',
		exportedAt: 0,
		board: {
			title: 'Visual fixture',
			createdAt: 0,
			doc: bytesToBase64(Y.encodeStateAsUpdate(doc)),
			assets: [
				{
					id: ASSET_ID,
					mime: 'image/png',
					width: image.width,
					height: image.height,
					data: image.base64
				}
			]
		}
	});
}
