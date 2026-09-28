<script lang="ts">
	import { getBoard } from '../context';
	import { styleToCss } from './common';
	import { definitionOf } from './registry';

	let { id }: { id: string } = $props();

	const { store } = getBoard();
	// SvelteMap tracks reads per key: this view re-renders only when its own element changes.
	const el = $derived(store.get(id));
</script>

{#if el}
	{@const View = definitionOf(el).component}
	<div
		class="pointer-events-none absolute top-0 left-0"
		style:width="{el.w}px"
		style:height="{el.h}px"
		style:transform="translate({el.x}px, {el.y}px) rotate({el.rotation}rad)"
		style={styleToCss(el.style)}
		data-element-id={id}
		data-type={el.type}
	>
		<View {el} editing={false} />
	</div>
{/if}
