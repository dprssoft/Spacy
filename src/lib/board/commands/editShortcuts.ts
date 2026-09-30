import type { Shortcut } from '../tools/shortcuts';
import {
	canGroup,
	canUngroup,
	deleteSelection,
	duplicateSelection,
	groupSelection,
	reorderSelection,
	toggleLock,
	ungroupSelection
} from './edit';

const hasSelection: Shortcut['when'] = (ctx) => ctx.selection.size > 0;

// Copy/cut/paste are not shortcuts: they use the browser's native clipboard events (see clipboard.ts).
export const editShortcuts: Shortcut[] = [
	{
		id: 'edit.undo',
		keys: ['Mod+Z'],
		label: 'Undo',
		group: 'Edit',
		run: (ctx) => ctx.history.undo()
	},
	{
		id: 'edit.redo',
		keys: ['Mod+Shift+Z', 'Mod+Y'],
		label: 'Redo',
		group: 'Edit',
		run: (ctx) => ctx.history.redo()
	},
	{
		id: 'edit.delete',
		keys: ['Delete', 'Backspace'],
		label: 'Delete',
		group: 'Edit',
		when: hasSelection,
		run: deleteSelection
	},
	{
		id: 'edit.duplicate',
		keys: ['Mod+D'],
		label: 'Duplicate',
		group: 'Edit',
		when: hasSelection,
		run: (ctx) => duplicateSelection(ctx)
	},
	{
		id: 'arrange.front',
		keys: ['Mod+]'],
		label: 'Bring to front',
		group: 'Arrange',
		when: hasSelection,
		run: (ctx) => reorderSelection(ctx, 'front')
	},
	{
		id: 'arrange.back',
		keys: ['Mod+['],
		label: 'Send to back',
		group: 'Arrange',
		when: hasSelection,
		run: (ctx) => reorderSelection(ctx, 'back')
	},
	{
		id: 'arrange.forward',
		keys: [']'],
		label: 'Bring forward',
		group: 'Arrange',
		when: hasSelection,
		run: (ctx) => reorderSelection(ctx, 'forward')
	},
	{
		id: 'arrange.backward',
		keys: ['['],
		label: 'Send backward',
		group: 'Arrange',
		when: hasSelection,
		run: (ctx) => reorderSelection(ctx, 'backward')
	},
	{
		id: 'arrange.lock',
		keys: ['Mod+Shift+L'],
		label: 'Lock / unlock',
		group: 'Arrange',
		when: hasSelection,
		run: toggleLock
	},
	{
		id: 'arrange.group',
		keys: ['Mod+G'],
		label: 'Group',
		group: 'Arrange',
		when: canGroup,
		run: groupSelection
	},
	{
		id: 'arrange.ungroup',
		keys: ['Mod+Shift+G'],
		label: 'Ungroup',
		group: 'Arrange',
		when: canUngroup,
		run: ungroupSelection
	}
];
