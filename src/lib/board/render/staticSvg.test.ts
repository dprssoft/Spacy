import { describe, expect, it } from 'vitest';
import { samples } from '$lib/model/testFixtures';
import type { Element, ElementType } from '$lib/model/types';
import { sampleElements } from '../elements/fixtures';
import { renderStaticSvg, type StaticRenderOptions } from './staticSvg';

const TYPES: ElementType[] = [
	'frame',
	'shape',
	'sticky',
	'text',
	'image',
	'stroke',
	'sketch',
	'doccard',
	'connector',
	'media',
	'widget'
];

function options(
	elements: Element[],
	extra: Partial<StaticRenderOptions> = {}
): StaticRenderOptions {
	const byId = new Map(elements.map((e) => [e.id, e]));
	return {
		elements,
		lookup: (id) => byId.get(id),
		background: '#ffffff',
		measure: (t, f) => t.length * f.size * 0.55,
		assetDataUrl: async () => 'data:image/png;base64,iVBORw0KGgo=',
		docLines: async () => [
			{ text: 'Plan', kind: 'h' },
			{ text: '• first item', kind: 'li' },
			{ text: 'Some body text that wraps over more than one line in the card.', kind: 'p' }
		],
		...extra
	};
}

const parse = (svg: string) => new DOMParser().parseFromString(svg, 'image/svg+xml');

describe('renderStaticSvg', () => {
	it('renders every element type as valid standalone SVG', async () => {
		const els = TYPES.flatMap(sampleElements).map((e, i) => ({ ...e, id: `${e.id}-${i}` }));
		const { svg, width, height } = await renderStaticSvg(options(els));
		const dom = parse(svg);
		expect(dom.getElementsByTagName('parsererror')).toHaveLength(0);
		expect(svg).not.toContain('foreignObject');
		const root = dom.documentElement;
		expect(root.getAttribute('width')).toBe(String(width));
		expect(root.getAttribute('height')).toBe(String(height));
		const groups = [...root.children].filter((c) => c.tagName === 'g');
		expect(groups).toHaveLength(els.length);
		// No external references besides data URLs.
		expect(svg).not.toMatch(/href="(?!data:)/);
	});

	it('writes text in its font and embeds the given font rules', async () => {
		const plain = { ...samples.shape('a'), text: 'Plain' };
		const fancy = {
			...samples.shape('b'),
			x: 300,
			text: 'Fancy',
			style: {
				...samples.shape('b').style,
				font: { ...samples.shape('b').style.font, family: 'caveat' }
			}
		};
		const css = '@font-face{font-family:"Spacy Caveat";src:url(data:font/woff2;base64,AA)}';
		const { svg } = await renderStaticSvg(options([plain, fancy], { fontCss: css }));
		const dom = parse(svg);
		expect(dom.getElementsByTagName('parsererror')).toHaveLength(0);
		const texts = [...dom.getElementsByTagName('text')];
		expect(texts.find((t) => t.textContent === 'Plain')?.getAttribute('font-family')).toBeNull();
		expect(texts.find((t) => t.textContent === 'Fancy')?.getAttribute('font-family')).toMatch(
			/^"Spacy Caveat", cursive$/
		);
		expect(dom.getElementsByTagName('style')[0]?.textContent).toBe(css);
	});

	it('escapes text for XML', async () => {
		const shape = { ...samples.shape('s'), w: 600, text: 'a <b> & "c" \'d\'' };
		const { svg } = await renderStaticSvg(options([shape]));
		expect(parse(svg).getElementsByTagName('parsererror')).toHaveLength(0);
		expect(parse(svg).querySelector('text')?.textContent).toBe('a <b> & "c" \'d\'');
	});

	it('wraps text, leaves out the background when transparent and pads the bounds', async () => {
		const shape = {
			...samples.shape('s'),
			x: 0,
			y: 0,
			w: 100,
			h: 60,
			text: 'one two three four five six'
		};
		const { svg, viewBox } = await renderStaticSvg(
			options([shape], { background: 'transparent', padding: 10 })
		);
		expect(viewBox).toEqual({ x: -10, y: -10, w: 120, h: 80 });
		expect(parse(svg).querySelectorAll('text').length).toBeGreaterThan(1);
		expect(svg).not.toContain('fill="#ffffff"/>');
	});

	it('matches a small fixed snapshot', async () => {
		const shape = { ...samples.shape('s'), x: 0, y: 0, w: 120, h: 60, text: 'Hi' };
		const sticky = { ...samples.sticky('t'), x: 160, y: 0, w: 80, h: 80, text: 'Note' };
		const conn: Element = {
			...samples.connector('c'),
			from: { kind: 'port', elementId: 's', port: 'e', lastX: 120, lastY: 30 },
			to: { kind: 'port', elementId: 't', port: 'w', lastX: 160, lastY: 40 },
			routing: 'straight',
			waypoints: [],
			markerEnd: 'arrow',
			label: { text: '', t: 0.5, background: false }
		} as Element;
		const { svg } = await renderStaticSvg(options([shape, sticky, conn]));
		expect(svg).toMatchSnapshot();
	});

	it('draws a media element as its poster, without referring to the link', async () => {
		const media = { ...samples.media('m'), x: 0, y: 0, w: 480, h: 270, title: 'Launch talk' };
		const { svg } = await renderStaticSvg(options([media]));
		expect(svg).toContain('>Launch talk</text>');
		expect(svg).toContain('>YouTube</text>');
		expect(svg).not.toContain('youtu');
		expect(svg).not.toMatch(/<image|<iframe|<video/);
	});

	it('draws a widget as it shows at the time of export', async () => {
		const timer = {
			...samples.widget('w'),
			x: 0,
			y: 0,
			w: 240,
			h: 240,
			title: 'Break',
			config: { mode: 'countdown', duration: 300, sound: true },
			state: { startedAt: null, elapsed: 90_000 }
		};
		const { svg } = await renderStaticSvg(options([timer]));
		expect(parse(svg).getElementsByTagName('parsererror')).toHaveLength(0);
		expect(svg).toContain('>3:30</text>');
		expect(svg).toContain('>Break</text>');
		expect(svg).toMatchSnapshot();
	});
});
