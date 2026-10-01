import FileText from '@lucide/svelte/icons/file-text';
import Frame from '@lucide/svelte/icons/frame';
import Heading1 from '@lucide/svelte/icons/heading-1';
import Heading2 from '@lucide/svelte/icons/heading-2';
import Heading3 from '@lucide/svelte/icons/heading-3';
import List from '@lucide/svelte/icons/list';
import ListChecks from '@lucide/svelte/icons/list-checks';
import ListOrdered from '@lucide/svelte/icons/list-ordered';
import Minus from '@lucide/svelte/icons/minus';
import Quote from '@lucide/svelte/icons/quote';
import Square from '@lucide/svelte/icons/square';
import SquareCode from '@lucide/svelte/icons/square-code';
import StickyNote from '@lucide/svelte/icons/sticky-note';
import Type from '@lucide/svelte/icons/type';
import type { ElementType } from '$lib/model/types';
import type { BoardContext } from '../context';
import { createDocEditor, type DocEditorOptions, type Editor } from './editorFactory';
import { mentionExtensions, mentionItems, mentionStatusKey, type MentionItem } from './mentions';
import { slashExtension, type SlashId, type SlashItem } from './slash';
import { suggestionRenderer } from './suggestionPopup.svelte';

const SLASH_ICONS: Record<SlashId, typeof Square> = {
	h1: Heading1,
	h2: Heading2,
	h3: Heading3,
	bullet: List,
	ordered: ListOrdered,
	task: ListChecks,
	quote: Quote,
	code: SquareCode,
	divider: Minus
};
const TYPE_ICONS: Partial<Record<ElementType, typeof Square>> = {
	frame: Frame,
	doccard: FileText,
	shape: Square,
	sticky: StickyNote,
	text: Type
};

/** A doc card editor wired to the board: slash commands and `@` mentions of its objects. */
export function createBoardDocEditor(
	ctx: BoardContext,
	opts: Omit<DocEditorOptions, 'extra'>
): Editor {
	return createDocEditor({
		...opts,
		extra: [
			slashExtension(
				suggestionRenderer<SlashItem>('Commands', (i) => ({
					label: i.title,
					icon: SLASH_ICONS[i.id]
				}))
			),
			...mentionExtensions({
				items: (q) => mentionItems(ctx.store.elements.values(), q),
				render: suggestionRenderer<MentionItem>('Objects', (i) => ({
					label: i.label,
					icon: TYPE_ICONS[i.type]
				})),
				isMissing: (id) => !ctx.store.elements.has(id)
			})
		]
	});
}

/** Re-evaluates the "deleted object" styling of mention chips (after elements changed). */
export function refreshMentions(editor: Editor): void {
	if (editor.isDestroyed) return;
	editor.view.dispatch(editor.state.tr.setMeta(mentionStatusKey, true));
}

/** The mentioned element id when `target` is (inside) a mention chip. */
export function mentionAt(target: EventTarget | null): string | null {
	if (!(target instanceof Element)) return null;
	return target.closest<HTMLElement>('.mention[data-id]')?.dataset.id ?? null;
}
