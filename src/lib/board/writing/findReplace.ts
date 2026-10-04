import * as Y from 'yjs';
import { getDocsMap, readElement } from '$lib/model/doc';
import { updateElementsOnPage } from '$lib/model/ops';
import { LOCAL } from '$lib/model/origins';
import { getPages } from '$lib/model/pages';
import { pageElementsMap } from '$lib/model/doc';
import type { ElementPatch } from '$lib/model/types';
import {
	canvasFields,
	context,
	docTexts,
	plainText,
	type CanvasField,
	type Matcher
} from './search';

export interface Hit {
	key: string;
	kind: 'element' | 'doc';
	/** The element, or the doc card whose text matched. */
	elementId: string;
	pageId: string;
	field?: CanvasField;
	/** Index of the Yjs text node in the card (doc hits). */
	textIndex?: number;
	from: number;
	to: number;
	text: string;
	context: { before: string; match: string; after: string };
}

/** Every match on one page (or all pages), in page order and reading order. */
export function searchBoard(doc: Y.Doc, matcher: Matcher, pageIds: readonly string[]): Hit[] {
	const hits: Hit[] = [];
	const docs = getDocsMap(doc);
	for (const pageId of pageIds) {
		const els = [...pageElementsMap(doc, pageId).values()]
			.map(readElement)
			.filter((e) => e !== null)
			.sort((a, b) => (Math.abs(a.y - b.y) < 40 ? a.x - b.x : a.y - b.y));
		for (const el of els) {
			for (const { field, value } of canvasFields(el))
				for (const m of matcher.find(value))
					hits.push({
						key: `${el.id}:${field}:${m.from}`,
						kind: 'element',
						elementId: el.id,
						pageId,
						field,
						...m,
						context: context(value, m.from, m.to)
					});
			if (el.type !== 'doccard') continue;
			const frag = docs.get(el.id);
			if (!frag) continue;
			docTexts(frag).forEach((t, textIndex) => {
				const value = plainText(t);
				for (const m of matcher.find(value))
					hits.push({
						key: `${el.id}:doc:${textIndex}:${m.from}`,
						kind: 'doc',
						elementId: el.id,
						pageId,
						textIndex,
						...m,
						context: context(value, m.from, m.to)
					});
			});
		}
	}
	return hits;
}

export const allPageIds = (doc: Y.Doc) => getPages(doc).map((p) => p.id);

/**
 * Replaces the given hits (one transaction, so one undo step for everything). Hits whose text no
 * longer matches what was found (edited since) are skipped. Returns how many were replaced.
 */
export function replaceHits(
	doc: Y.Doc,
	hits: readonly Hit[],
	matcher: Matcher,
	replacement: string
): number {
	let done = 0;
	const desc = [...hits].sort((a, b) => b.from - a.from);
	doc.transact(() => {
		// Canvas fields, grouped per element and field.
		const byPage = new Map<string, Map<string, ElementPatch>>();
		const groups = new Map<string, Hit[]>();
		for (const h of desc) {
			if (h.kind !== 'element') continue;
			const key = `${h.pageId}\u0000${h.elementId}\u0000${h.field}`;
			groups.set(key, [...(groups.get(key) ?? []), h]);
		}
		for (const list of groups.values()) {
			const { pageId, elementId, field } = list[0]!;
			const ymap = pageElementsMap(doc, pageId).get(elementId);
			const el = ymap ? readElement(ymap) : null;
			if (!el) continue;
			let value = canvasFields(el).find((f) => f.field === field)?.value;
			if (value === undefined) continue;
			for (const h of list) {
				if (value.slice(h.from, h.to) !== h.text) continue;
				value = value.slice(0, h.from) + matcher.replace(h.text, replacement) + value.slice(h.to);
				done++;
			}
			const patches = byPage.get(pageId) ?? new Map<string, ElementPatch>();
			patches.set(
				elementId,
				field === 'label' && el.type === 'connector'
					? { label: { ...el.label, text: value } }
					: { [field!]: value }
			);
			byPage.set(pageId, patches);
		}
		for (const [pageId, patches] of byPage)
			updateElementsOnPage(
				doc,
				pageId,
				[...patches].map(([id, patch]) => ({ id, patch })),
				LOCAL
			);

		// Doc card text, node by node, back to front.
		const docs = getDocsMap(doc);
		const texts = new Map<string, Y.XmlText[]>();
		for (const h of desc) {
			if (h.kind !== 'doc' || h.textIndex === undefined) continue;
			const frag = docs.get(h.elementId);
			if (!frag) continue;
			let list = texts.get(h.elementId);
			if (!list) texts.set(h.elementId, (list = docTexts(frag)));
			const t = list[h.textIndex];
			if (!t || plainText(t).slice(h.from, h.to) !== h.text) continue;
			// Typed in after the match's first character, the new text takes that character's
			// formatting (Yjs inheritance); then the old characters go. (Deleting first and
			// inserting with copied attributes can leave a format range open.)
			const next = matcher.replace(h.text, replacement);
			t.insert(h.from + 1, next);
			t.delete(h.from + 1 + next.length, h.to - h.from - 1);
			t.delete(h.from, 1);
			done++;
		}
	}, LOCAL);
	return done;
}
