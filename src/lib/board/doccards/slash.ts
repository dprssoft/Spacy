import { Extension, type Editor, type Range } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';

export type SlashId =
	'h1' | 'h2' | 'h3' | 'bullet' | 'ordered' | 'task' | 'quote' | 'code' | 'divider' | 'table';

export interface SlashItem {
	id: SlashId;
	title: string;
	keywords: string[];
	/** Hidden where it can't be used (no table inside a table). */
	inTable?: false;
	run(editor: Editor, range: Range): void;
}

const block = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range);

export const SLASH_ITEMS: readonly SlashItem[] = [
	{
		id: 'h1',
		title: 'Heading 1',
		keywords: ['title', 'h1'],
		run: (e, r) => block(e, r).setNode('heading', { level: 1 }).run()
	},
	{
		id: 'h2',
		title: 'Heading 2',
		keywords: ['subtitle', 'h2'],
		run: (e, r) => block(e, r).setNode('heading', { level: 2 }).run()
	},
	{
		id: 'h3',
		title: 'Heading 3',
		keywords: ['h3'],
		run: (e, r) => block(e, r).setNode('heading', { level: 3 }).run()
	},
	{
		id: 'bullet',
		title: 'Bullet list',
		keywords: ['ul', 'unordered'],
		run: (e, r) => block(e, r).toggleBulletList().run()
	},
	{
		id: 'ordered',
		title: 'Numbered list',
		keywords: ['ol', 'ordered'],
		run: (e, r) => block(e, r).toggleOrderedList().run()
	},
	{
		id: 'task',
		title: 'Checklist',
		keywords: ['todo', 'task', 'checkbox'],
		run: (e, r) => block(e, r).toggleTaskList().run()
	},
	{
		id: 'quote',
		title: 'Quote',
		keywords: ['blockquote'],
		run: (e, r) => block(e, r).toggleBlockquote().run()
	},
	{
		id: 'code',
		title: 'Code block',
		keywords: ['pre', 'snippet'],
		run: (e, r) => block(e, r).toggleCodeBlock().run()
	},
	{
		id: 'divider',
		title: 'Divider',
		keywords: ['hr', 'line', 'separator'],
		run: (e, r) => block(e, r).setHorizontalRule().run()
	},
	{
		id: 'table',
		title: 'Table',
		keywords: ['grid', 'columns'],
		inTable: false,
		run: (e, r) => block(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
	}
];

/** Items whose title or keywords start with the query first, then those that merely contain it. */
export function filterSlash(query: string, items: readonly SlashItem[] = SLASH_ITEMS): SlashItem[] {
	const q = query.trim().toLowerCase();
	if (!q) return [...items];
	const words = (i: SlashItem) => [i.title.toLowerCase(), ...i.keywords];
	const prefix = items.filter((i) =>
		words(i).some((w) => w.startsWith(q) || w.split(' ').some((p) => p.startsWith(q)))
	);
	const rest = items.filter((i) => !prefix.includes(i) && words(i).some((w) => w.includes(q)));
	return [...prefix, ...rest];
}

export type SlashRender = NonNullable<SuggestionOptions<SlashItem, SlashItem>['render']>;

export const slashPluginKey = new PluginKey('slash');

/** `/` commands, at the start of a block or after a space. */
export function slashExtension(render: SlashRender) {
	return Extension.create({
		name: 'slashCommands',
		addProseMirrorPlugins() {
			return [
				Suggestion<SlashItem, SlashItem>({
					editor: this.editor,
					char: '/',
					pluginKey: slashPluginKey,
					allowedPrefixes: [' '],
					items: ({ query, editor }) => {
						const inTable = editor.isActive('table');
						return filterSlash(query).filter((i) => !(inTable && i.inTable === false));
					},
					command: ({ editor, range, props }) => props.run(editor, range),
					render
				})
			];
		}
	});
}
