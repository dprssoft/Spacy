<script lang="ts">
	import { getBoard } from '../context';
	import { styleToCss } from './common';
	import { definitionOf } from './registry';
	import TextEditor from './TextEditor.svelte';

	let { id }: { id: string } = $props();

	const { store, selection, preview } = getBoard();
	// SvelteMap tracks reads per key: this view re-renders only when its own element changes.
	const el = $derived(store.get(id));
	const editing = $derived(selection.editingId === id);
</script>

{#if el}
	{@const def = definitionOf(el)}
	{@const View = def.component}
	{@const isConnector = el.type === 'connector'}
	<!-- Connectors draw in absolute world coordinates (their geometry is derived), others in their box. -->
	<div
		class="pointer-events-none absolute top-0 left-0"
		style:width={isConnector ? '0px' : `${el.w}px`}
		style:height={isConnector ? '0px' : `${el.h}px`}
		style:transform={isConnector
			? undefined
			: `translate(${el.x}px, ${el.y}px) rotate(${el.rotation}rad)`}
		style={styleToCss(el.style)}
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
