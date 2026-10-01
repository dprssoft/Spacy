import * as Y from 'yjs';
import { getDocsMap, listElements } from '$lib/model/doc';
import { docLines } from '$lib/board/doccards/docLines';
import { thumbnailFromSvg, THUMB_BG } from '$lib/board/render/thumbnails';
import { renderStaticSvg, type StaticSvg } from '$lib/board/render/staticSvg';
import { createCanvasMeasurer } from '$lib/board/render/wrapText';
import { fragmentToJSON } from './docContent';
import type { Template } from './index';

/** Renders a document's board (frames first, then by z) to SVG, without a board context. */
export async function renderDocSvg(
	doc: Y.Doc,
	opts: { background: string; padding?: number }
): Promise<StaticSvg | null> {
	const all = listElements(doc);
	if (all.length === 0) return null;
	const elements = [
		...all.filter((e) => e.type === 'frame'),
		...all.filter((e) => e.type !== 'frame')
	];
	const byId = new Map(all.map((e) => [e.id, e]));
	const docs = getDocsMap(doc);
	return renderStaticSvg({
		elements,
		lookup: (id) => byId.get(id),
		background: opts.background,
		padding: opts.padding,
		measure: createCanvasMeasurer(),
		assetDataUrl: async () => null,
		docLines: async (id) => {
			const frag = docs.get(id);
			return frag ? docLines(fragmentToJSON(frag)) : [];
		}
	});
}

export async function thumbnailForDoc(doc: Y.Doc): Promise<Blob | null> {
	return thumbnailFromSvg(await renderDocSvg(doc, { background: THUMB_BG, padding: 0 }));
}

const previews = new Map<string, Promise<string>>();

/** An SVG data URL of the template, built in memory once per session. */
export function templatePreview(t: Template): Promise<string> {
	let p = previews.get(t.id);
	if (!p) {
		p = (async () => {
			const doc = new Y.Doc();
			await t.build(doc);
			const out = await renderDocSvg(doc, { background: '#ffffff', padding: 16 });
			doc.destroy();
			return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(out?.svg ?? '')}`;
		})();
		previews.set(t.id, p);
		p.catch(() => previews.delete(t.id));
	}
	return p;
}
