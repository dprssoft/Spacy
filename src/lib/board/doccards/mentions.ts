import { Extension } from '@tiptap/core';
import Mention from '@tiptap/extension-mention';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { SuggestionOptions } from '@tiptap/suggestion';
import type { Element, ElementType } from '$lib/model/types';

export interface MentionItem {
	id: string;
	label: string;
	type: ElementType;
}

const LABEL_MAX = 40;

/** What a mention of `el` is called, or null when it can't be mentioned. */
export function mentionLabel(el: Element): string | null {
	switch (el.type) {
		case 'frame':
		case 'doccard':
			return el.title.trim() || null;
		case 'shape':
		case 'sticky':
		case 'text': {
			const line = el.text.replace(/\s+/g, ' ').trim();
			return line ? line.slice(0, LABEL_MAX) : null;
		}
		default:
			return null;
	}
}

/** Mentionable elements matching `query`: prefix matches first, then substring; at most `limit`. */
export function mentionItems(elements: Iterable<Element>, query: string, limit = 8): MentionItem[] {
	const q = query.trim().toLowerCase();
	const prefix: MentionItem[] = [];
	const contains: MentionItem[] = [];
	for (const el of elements) {
		const label = mentionLabel(el);
		if (!label) continue;
		const l = label.toLowerCase();
		const item = { id: el.id, label, type: el.type };
		if (l.startsWith(q)) prefix.push(item);
		else if (l.includes(q)) contains.push(item);
	}
	const byLabel = (a: MentionItem, b: MentionItem) => a.label.localeCompare(b.label);
	return [...prefix.sort(byLabel), ...contains.sort(byLabel)].slice(0, limit);
}

export type MentionRender = NonNullable<SuggestionOptions<MentionItem, MentionItem>['render']>;

export const mentionStatusKey = new PluginKey('mentionStatus');

export interface MentionOptions {
	items(query: string): MentionItem[];
	render: MentionRender;
	/** True when the mentioned element no longer exists (the chip is struck through). */
	isMissing(id: string): boolean;
}

/**
 * `@` mentions of canvas objects. The label is stored when inserted and not updated afterwards
 * (renaming the object leaves existing chips as they were).
 */
export function mentionExtensions(opts: MentionOptions) {
	const status = Extension.create({
		name: 'mentionStatus',
		addProseMirrorPlugins() {
			return [
				new Plugin({
					key: mentionStatusKey,
					props: {
						decorations(state) {
							const found: Decoration[] = [];
							state.doc.descendants((node, pos) => {
								if (node.type.name !== 'mention') return;
								const id: unknown = node.attrs.id;
								if (typeof id === 'string' && opts.isMissing(id))
									found.push(
										Decoration.node(pos, pos + node.nodeSize, { class: 'mention-missing' })
									);
							});
							return DecorationSet.create(state.doc, found);
						}
					}
				})
			];
		}
	});
	return [
		Mention.configure({
			HTMLAttributes: { class: 'mention' },
			suggestion: {
				char: '@',
				items: ({ query }) => opts.items(query),
				render: opts.render as never
			}
		}),
		status
	];
}
