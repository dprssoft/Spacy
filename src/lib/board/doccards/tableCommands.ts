// Table actions for the doc card ribbon. Types only: importing this doesn't load TipTap.
import type { Editor } from './editorFactory';

export interface TableAction {
	id: string;
	label: string;
	/** Starts a new group in the menu. */
	separated?: boolean;
	run(editor: Editor): boolean;
}

export const NEW_TABLE = { rows: 3, cols: 3, withHeaderRow: true } as const;

export const insertTable = (editor: Editor): boolean =>
	editor.chain().focus().insertTable(NEW_TABLE).run();

export const inTable = (editor: Editor): boolean => editor.isActive('table');

export const TABLE_ACTIONS: readonly TableAction[] = [
	{ id: 'rowAbove', label: 'Insert row above', run: (e) => e.chain().focus().addRowBefore().run() },
	{ id: 'rowBelow', label: 'Insert row below', run: (e) => e.chain().focus().addRowAfter().run() },
	{
		id: 'colLeft',
		label: 'Insert column left',
		run: (e) => e.chain().focus().addColumnBefore().run()
	},
	{
		id: 'colRight',
		label: 'Insert column right',
		run: (e) => e.chain().focus().addColumnAfter().run()
	},
	{
		id: 'deleteRow',
		label: 'Delete row',
		separated: true,
		run: (e) => e.chain().focus().deleteRow().run()
	},
	{ id: 'deleteCol', label: 'Delete column', run: (e) => e.chain().focus().deleteColumn().run() },
	{
		id: 'headerRow',
		label: 'Header row',
		separated: true,
		run: (e) => e.chain().focus().toggleHeaderRow().run()
	},
	{
		id: 'deleteTable',
		label: 'Delete table',
		separated: true,
		run: (e) => e.chain().focus().deleteTable().run()
	}
];

/** Whether the table's first row is a header row. */
export function hasHeaderRow(editor: Editor): boolean {
	const { $from } = editor.state.selection;
	for (let d = $from.depth; d > 0; d--) {
		const node = $from.node(d);
		if (node.type.name !== 'table') continue;
		const first = node.firstChild;
		let all = !!first && first.childCount > 0;
		first?.forEach((cell) => {
			if (cell.type.name !== 'tableHeader') all = false;
		});
		return all;
	}
	return false;
}
