import type { Port } from '$lib/model/types';
import type { Shortcut } from '../tools/shortcuts';
import { connectedComponent, quickCreate } from './quickCreate';
import { definitionOf } from '../elements';

const quick = (port: Port, key: string, label: string): Shortcut => ({
	id: `diagram.quick.${port}`,
	keys: [`Mod+Alt+${key}`],
	label,
	group: 'Diagram',
	when: (ctx) => ctx.selection.single !== null,
	run: (ctx) => {
		const id = quickCreate(ctx, ctx.selection.single!, port);
		if (!id) return;
		ctx.selection.set([id]);
		const el = ctx.store.get(id);
		if (el && definitionOf(el).editableText && el.type !== 'frame') {
			ctx.editing.start(id, { discardIfEmpty: el.type === 'text' });
		}
	}
});

export const diagramShortcuts: Shortcut[] = [
	quick('e', 'ArrowRight', 'Add connected element to the right'),
	quick('w', 'ArrowLeft', 'Add connected element to the left'),
	quick('n', 'ArrowUp', 'Add connected element above'),
	quick('s', 'ArrowDown', 'Add connected element below'),
	{
		id: 'diagram.selectConnected',
		keys: ['Mod+Shift+A'],
		label: 'Select connected',
		group: 'Diagram',
		when: (ctx) => ctx.selection.size > 0,
		run: (ctx) => ctx.selection.set(connectedComponent(ctx, ctx.selection.ids))
	}
];
