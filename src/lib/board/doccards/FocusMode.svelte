<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import X from '@lucide/svelte/icons/x';
	import { untrack } from 'svelte';
	import { getDocsMap } from '$lib/model/doc';
	import { updateElement } from '$lib/model/ops';
	import type { DocCardElement } from '$lib/model/types';
	import InlineEditable from '$lib/shared/ui/InlineEditable.svelte';
	import { getBoard } from '../context';
	import BubbleMenu from './BubbleMenu.svelte';
	import DocCardMenu from './DocCardMenu.svelte';
	import type { Editor } from './editorFactory';
	import { closeFocus } from './focus';
	import { jumpToElement, mentionAt } from './jumpTo';
	import { loadBoardEditor, type BoardEditorModule } from './lazy';
	import './prose.css';
	import { isSuggestionKey } from './suggestionPopup.svelte';

	let { card }: { card: DocCardElement } = $props();

	const ctx = getBoard();
	// svelte-ignore state_referenced_locally
	const id = card.id;
	let overlay = $state<HTMLDivElement>();
	let body = $state<HTMLDivElement>();
	let menu = $state<HTMLDivElement>();
	let editor = $state.raw<Editor | null>(null);
	let editorModule = $state.raw<BoardEditorModule | null>(null);
	$effect(() => {
		let alive = true;
		void loadBoardEditor()
			.then((m) => {
				if (alive) editorModule = m;
			})
			.catch((err: unknown) => console.error('Editor failed to load', err));
		return () => {
			alive = false;
		};
	});
	let renaming = $state(false);

	const close = () => closeFocus(ctx.id);

	$effect(() => {
		// The canvas card goes read-only while its content is edited here.
		untrack(() => ctx.editing.end());
		return () => {
			// Give the keyboard back to the canvas.
			document.querySelector<HTMLElement>('[data-testid="canvas"]')?.focus({ preventScroll: true });
		};
	});

	$effect(() => {
		if (!body || !menu || !overlay || !editorModule) return;
		const fragment = getDocsMap(ctx.doc).get(id);
		if (!fragment) return;
		const ed = editorModule.createBoardDocEditor(ctx, {
			element: body,
			fragment,
			editable: true,
			placeholder: 'Write something, or type / for commands…',
			bubbleMenu: menu,
			// Inside the dialog so the link input stays within the focus trap.
			bubbleMenuParent: overlay
		});
		editor = ed;
		ed.commands.focus('end');
		return () => {
			editor = null;
			ed.destroy();
		};
	});

	$effect(() => {
		void ctx.store.elements.size;
		if (editor && editorModule) untrack(() => editorModule!.refreshMentions(editor!));
	});

	function onkeydown(e: KeyboardEvent) {
		if (isSuggestionKey(e)) return;
		// Keys in menus (the ⋯ menu) belong to them.
		if (e.target instanceof Element && e.target.closest('[role=menu]')) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			close();
		} else if (e.key === 'Tab' && overlay) {
			trapTab(e, overlay);
		}
	}

	function trapTab(e: KeyboardEvent, root: HTMLElement) {
		const focusable = [
			...root.querySelectorAll<HTMLElement>(
				'button, input, [contenteditable="true"], [tabindex="0"]'
			)
		].filter((n) => n.offsetParent !== null);
		const first = focusable[0];
		const last = focusable.at(-1);
		if (!first || !last) return;
		const inside = root.contains(document.activeElement);
		if (e.shiftKey && (document.activeElement === first || !inside)) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && (document.activeElement === last || !inside)) {
			e.preventDefault();
			first.focus();
		}
	}

	function onclick(e: MouseEvent) {
		const target = mentionAt(e.target);
		if (target) jumpToElement(ctx, target);
	}

	const iconButton =
		'inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none';
</script>

<svelte:window {onkeydown} />

<div
	bind:this={overlay}
	role="dialog"
	aria-modal="true"
	aria-label="Doc card: {card.title}"
	data-interactive
	data-focus-mode
	class="fixed inset-0 z-50 flex flex-col bg-surface text-text"
>
	<header class="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
		<button type="button" class={iconButton} onclick={close}>
			<ArrowLeft class="size-4" aria-hidden="true" />Board
		</button>
		<div class="flex min-w-0 flex-1 justify-center">
			{#if renaming}
				<div class="w-full max-w-md">
					<InlineEditable
						bind:editing={renaming}
						value={card.title}
						ariaLabel="Doc card title"
						inputClass="text-center font-semibold"
						onCommit={(title) => updateElement(ctx.doc, id, { title })}
					/>
				</div>
			{:else}
				<button
					type="button"
					class="max-w-full truncate rounded-md px-2 py-1 font-semibold hover:bg-surface-2"
					title="Rename"
					onclick={() => (renaming = true)}
				>
					{card.title}
				</button>
			{/if}
		</div>
		<DocCardMenu cardId={id} class={iconButton} />
		<button type="button" class={iconButton} aria-label="Close focus mode" onclick={close}>
			<X class="size-4" aria-hidden="true" />
		</button>
	</header>
	<div class="min-h-0 flex-1 overflow-y-auto">
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (mention chips are links for the pointer; the editor handles keys) -->
		<div
			bind:this={body}
			class="doc-prose mx-auto max-w-[760px] px-6 py-10"
			style:font-size="17px"
			data-focus-body
			{onclick}
		></div>
	</div>
	<div class="hidden"><BubbleMenu {editor} bind:element={menu} /></div>
</div>
