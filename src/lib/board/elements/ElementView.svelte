<script lang="ts">
	import { countRender } from '$lib/dev/testHooks';
	import { getBoard } from '../context';
	import { styleToCss } from './common';
	import { definitionOf } from './registry';
	import TextEditor from './TextEditor.svelte';

	let { id }: { id: string } = $props();

	const { store, selection, preview } = getBoard();
	// SvelteMap tracks reads per key: this view re-renders only when its own element changes.
	const el = $derived(store.get(id));
	const editing = $derived(selection.editingId === id);
	// One style string: cheaper to update on every frame of a drag than a style attribute merged
	// with style: directives. Connectors draw in absolute world coordinates (their geometry is
	// derived), others in their box.
	const css = $derived.by(() => {
		if (!el) return '';
		const box =
			el.type === 'connector'
				? 'width:0px;height:0px'
				: `width:${el.w}px;height:${el.h}px;transform:translate(${el.x}px, ${el.y}px) rotate(${el.rotation}rad)`;
		return `${box};${styleToCss(el.style)}`;
	});

	// Counts renders of this element for the perf guard (a no-op unless test hooks are enabled).
	$effect.pre(() => {
		void el;
		countRender(id);
	});
</script>

{#if el}
	{@const def = definitionOf(el)}
	{@const View = def.component}
	<div
		class="pointer-events-none absolute top-0 left-0"
		style={css}
		data-element-id={id}
		data-type={el.type}
		class:opacity-30={preview.erasing.has(id)}
	>
		<View {el} {editing} />
		{#if editing && def.editableText && (el.type === 'shape' || el.type === 'sticky' || el.type === 'text')}
			<TextEditor {el} />
		{/if}
	</div>
{/if}
