<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import X from '@lucide/svelte/icons/x';
	import { untrack } from 'svelte';
	import { fontStack } from '$lib/fonts/catalog';
	import { getDocsMap } from '$lib/model/doc';
	import { updateElement } from '$lib/model/ops';
	import type { DocCardElement } from '$lib/model/types';
	import InlineEditable from '$lib/shared/ui/InlineEditable.svelte';
	import { getBoard } from '../context';
	import { rovingTabindex } from '../ui/rovingTabindex';
	import BubbleMenu from './BubbleMenu.svelte';
	import DocCardMenu from './DocCardMenu.svelte';
	import DocRibbon from './DocRibbon.svelte';
	import type { Editor } from './editorFactory';
	import { closeFocus } from './focus';
	import { jumpToElement, mentionAt } from './jumpTo';
	import { loadBoardEditor, type BoardEditorModule } from './lazy';
	import './prose.css';
	import { isSuggestionKey } from './suggestionPopup.svelte';
	import FocusCounter from './FocusCounter.svelte';
	import FocusViewMenu from './FocusViewMenu.svelte';
	import { watchEditorStats, type LiveStats } from '../writing/editorStats';
	import { focusPrefs, SIZE_PX, WIDTH_CH } from '../writing/focusPrefs.svelte';

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

	// --- Writing aids (step 39), all optional -----------------------------------------------
	const prefs = $derived(focusPrefs.value);
	let stats = $state<LiveStats | null>(null);
	$effect(() => {
		const ed = editor;
		if (!ed) return;
		return watchEditorStats(ed, (st) => (stats = st));
	});

	// Typewriter scrolling: the caret's line stays at 40 % of the writing area's height.
	let scroller = $state<HTMLDivElement>();
	$effect(() => {
		const ed = editor;
		const box = scroller;
		if (!ed || !box || !prefs.typewriter) return;
		const center = () => {
			if (ed.isDestroyed) return;
			const caret = ed.view.coordsAtPos(ed.state.selection.head);
			const r = box.getBoundingClientRect();
			box.scrollTop += caret.top - (r.top + r.height * 0.4);
		};
		ed.on('selectionUpdate', center);
		ed.on('update', center);
		center();
		return () => {
			ed.off('selectionUpdate', center);
			ed.off('update', center);
		};
	});

	// Hide interface: only the text stays; the bars come back on mouse movement or a tap.
	let chromeVisible = $state(true);
	$effect(() => {
		if (!prefs.hideUi) {
			chromeVisible = true;
			return;
		}
		let timer = setTimeout(() => (chromeVisible = false), 2000);
		const wake = () => {
			chromeVisible = true;
			clearTimeout(timer);
			timer = setTimeout(() => (chromeVisible = false), 2000);
		};
		window.addEventListener('pointermove', wake);
		window.addEventListener('pointerdown', wake);
		return () => {
			clearTimeout(timer);
			window.removeEventListener('pointermove', wake);
			window.removeEventListener('pointerdown', wake);
		};
	});
	const chrome = $derived(
		chromeVisible ? 'transition-opacity' : 'pointer-events-none opacity-0 transition-opacity'
	);

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
	<header
		class="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3 {chrome}"
		data-focus-header
	>
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
		<FocusViewMenu class={iconButton} />
		<DocCardMenu cardId={id} class={iconButton} />
		<button type="button" class={iconButton} aria-label="Close focus mode" onclick={close}>
			<X class="size-4" aria-hidden="true" />
		</button>
	</header>
	{#if editor}
		<div
			role="toolbar"
			aria-label="Formatting"
			aria-orientation="horizontal"
			{@attach rovingTabindex()}
			class="flex shrink-0 items-stretch justify-center overflow-x-auto border-b border-border px-1 {chrome}"
		>
			<DocRibbon {editor} />
		</div>
	{/if}
	<div
		bind:this={scroller}
		class="min-h-0 flex-1 overflow-y-auto"
		class:focus-paragraph={prefs.focusParagraph}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (mention chips are links for the pointer; the editor handles keys) -->
		<div
			bind:this={body}
			class="doc-prose mx-auto px-6 py-10"
			class:pb-[50vh]={prefs.typewriter}
			style:max-width="{WIDTH_CH[prefs.width]}ch"
			style:font-size="{SIZE_PX[prefs.size]}px"
			style:font-family={fontStack(prefs.font === 'serif' ? 'lora' : card.style.font.family)}
			data-focus-body
			{onclick}
		></div>
	</div>
	<div class="absolute right-3 bottom-3 {chrome}">
		<FocusCounter {stats} />
	</div>
	<div class="hidden"><BubbleMenu {editor} bind:element={menu} /></div>
</div>
