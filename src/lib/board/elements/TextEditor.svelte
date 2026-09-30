<script lang="ts">
	import { STICKY_TEXT_COLOR } from '$lib/model/defaults';
	import { updateElement } from '$lib/model/ops';
	import type { ShapeElement, StickyElement, TextElement } from '$lib/model/types';
	import { debounce } from '$lib/shared/debounce';
	import { getBoard } from '../context';
	import { fontToCss, valignToJustify } from './common';

	type Editable = ShapeElement | StickyElement | TextElement;
	let { el }: { el: Editable } = $props();

	const ctx = getBoard();
	// The element's identity is fixed for this editor's lifetime.
	// svelte-ignore state_referenced_locally
	const id = el.id;
	// svelte-ignore state_referenced_locally
	let value = $state(el.text);
	let textarea = $state<HTMLTextAreaElement>();
	let mirror = $state<HTMLSpanElement>();
	let closed = false;

	const autoWidth = $derived(el.type === 'text' && el.autoWidth);
	const font = $derived(
		fontToCss(el.type === 'sticky' ? { ...el.style.font, color: STICKY_TEXT_COLOR } : el.style.font)
	);
	const padding = $derived(el.type === 'sticky' ? 16 : el.type === 'shape' ? 8 : 0);

	/** Text plus, for auto-width texts, the measured box. */
	function patch(): { text: string; w?: number; h?: number } {
		if (!autoWidth || !mirror) return { text: value };
		return {
			text: value,
			w: Math.max(20, Math.ceil(mirror.offsetWidth) + 2),
			h: Math.max(1, Math.ceil(mirror.offsetHeight))
		};
	}

	const write = debounce(() => updateElement(ctx.doc, id, patch()), 150);

	function fitHeight() {
		if (!textarea) return;
		textarea.style.height = 'auto';
		textarea.style.height = `${textarea.scrollHeight}px`;
	}

	function close() {
		if (closed) return;
		closed = true;
		write.flush();
		ctx.editing.end();
	}

	function oninput() {
		fitHeight();
		write();
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
			e.preventDefault();
			e.stopPropagation();
			close();
		}
	}

	function focusOnMount(node: HTMLTextAreaElement) {
		node.focus({ preventScroll: true });
		node.setSelectionRange(node.value.length, node.value.length);
		fitHeight();
	}

	// Leaving editing by other means (selection cleared, element deleted) still saves.
	$effect(() => () => {
		if (!closed) write.flush();
	});
</script>

<div
	class="pointer-events-auto absolute inset-0 flex flex-col"
	style:padding="{padding}px"
	style:justify-content={el.type === 'text' ? 'flex-start' : valignToJustify(el.style.font.valign)}
	data-interactive
>
	<textarea
		{@attach focusOnMount}
		bind:this={textarea}
		bind:value
		{oninput}
		{onkeydown}
		onblur={close}
		aria-label="Edit text"
		spellcheck="true"
		rows="1"
		wrap={autoWidth ? 'off' : 'soft'}
		class="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none"
		style="{font};{autoWidth ? 'white-space:pre;' : ''}"></textarea>
	{#if autoWidth}
		<!-- Measures the text for auto-width texts; same font, never visible. -->
		<span
			bind:this={mirror}
			class="pointer-events-none invisible absolute top-0 left-0 whitespace-pre"
			style={font}
			aria-hidden="true">{value || ' '}{value.endsWith('\n') ? ' ' : ''}</span
		>
	{/if}
</div>
