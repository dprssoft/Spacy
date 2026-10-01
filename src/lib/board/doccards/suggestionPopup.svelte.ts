import { mount, unmount } from 'svelte';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import SuggestionList, { type SuggestionEntry } from './SuggestionList.svelte';

let open = 0;
// Keys a popup handled. ProseMirror prevents the default of every Escape, so outer handlers
// (end editing, close focus mode) can't rely on `defaultPrevented` to see them.
const consumed = new WeakSet<KeyboardEvent>();

/** True while a slash or mention popup is showing, or when `e` was handled by one. */
export function isSuggestionKey(e?: KeyboardEvent): boolean {
	return open > 0 || (!!e && consumed.has(e));
}

/** A TipTap suggestion `render` that shows `SuggestionList` (keyboard: arrows, Enter, Escape). */
export function suggestionRenderer<I>(label: string, toEntry: (item: I) => SuggestionEntry) {
	return () => {
		let component: ReturnType<typeof mount> | null = null;
		let current: SuggestionProps<I, I> | null = null;
		const props = $state({
			entries: [] as SuggestionEntry[],
			selected: 0,
			rect: null as DOMRect | null,
			label,
			onpick: (i: number) => pick(i)
		});

		function pick(i: number) {
			const item = current?.items[i];
			if (item !== undefined) current?.command(item);
		}

		function update(p: SuggestionProps<I, I>) {
			current = p;
			props.entries = p.items.map(toEntry);
			props.selected = Math.min(props.selected, Math.max(0, p.items.length - 1));
			props.rect = p.clientRect?.() ?? null;
		}

		function close() {
			if (!component) return;
			void unmount(component);
			component = null;
			open--;
		}

		return {
			onStart(p: SuggestionProps<I, I>) {
				props.selected = 0;
				update(p);
				component = mount(SuggestionList, { target: document.body, props });
				open++;
			},
			onUpdate(p: SuggestionProps<I, I>) {
				update(p);
			},
			onKeyDown({ event }: SuggestionKeyDownProps) {
				const n = props.entries.length;
				if (event.key === 'Escape') {
					consumed.add(event);
					close();
					return true;
				}
				if (n === 0) return false;
				if (event.key === 'ArrowDown') props.selected = (props.selected + 1) % n;
				else if (event.key === 'ArrowUp') props.selected = (props.selected - 1 + n) % n;
				else if (event.key === 'Enter' || event.key === 'Tab') pick(props.selected);
				else return false;
				consumed.add(event);
				return true;
			},
			onExit() {
				close();
				current = null;
			}
		};
	};
}
