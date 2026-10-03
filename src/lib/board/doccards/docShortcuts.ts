import type { BoardContext } from '../context';
import type { Shortcut } from '../tools/shortcuts';
import { openFocus } from './focus';

const selectedCard = (ctx: BoardContext) => {
	const id = ctx.selection.single;
	const el = id ? ctx.store.get(id) : undefined;
	return el?.type === 'doccard' ? el : null;
};

/** Listed in the shortcut help only: the editor handles them itself. */
const editorKey = (id: string, keys: string, label: string): Shortcut => ({
	id: `doc.${id}`,
	keys: [keys],
	label,
	group: 'Doc',
	when: () => false,
	run: () => {}
});

export const docShortcuts: Shortcut[] = [
	{
		id: 'doc.focus',
		keys: ['Mod+Enter'],
		label: 'Open doc card in focus mode',
		group: 'Doc',
		when: (ctx) => !!selectedCard(ctx),
		run: (ctx) => {
			const card = selectedCard(ctx);
			if (card) openFocus(ctx.id, card.id);
		}
	},
	editorKey('bold', 'Mod+B', 'Bold'),
	editorKey('italic', 'Mod+I', 'Italic'),
	editorKey('underline', 'Mod+U', 'Underline'),
	editorKey('strike', 'Mod+Shift+X', 'Strikethrough'),
	editorKey('code', 'Mod+E', 'Inline code')
];
