<script lang="ts">
	import type { TextElement } from '$lib/model/types';
	import { fontToCss, inkFont } from '../common';
	import type { ElementViewProps } from '../registry';

	let { el, editing }: ElementViewProps<TextElement> = $props();
</script>

{#if !editing}
	<div
		class="absolute inset-0 break-words"
		class:whitespace-pre={el.autoWidth}
		class:whitespace-pre-wrap={!el.autoWidth}
		style={fontToCss(inkFont(el.style.font))}
	>
		{el.text}
	</div>
{/if}
