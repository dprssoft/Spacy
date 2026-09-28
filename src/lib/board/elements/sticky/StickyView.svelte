<script lang="ts">
	import { STICKY_TEXT_COLOR } from '$lib/model/defaults';
	import type { StickyElement } from '$lib/model/types';
	import { fontToCss, radiusPx, valignToJustify } from '../common';
	import type { ElementViewProps } from '../registry';

	let { el, editing }: ElementViewProps<StickyElement> = $props();
</script>

<div
	class="absolute inset-0 flex flex-col overflow-hidden p-4 break-words whitespace-pre-wrap"
	style="background:{el.color};border-radius:{radiusPx(
		el.style
	)}px;justify-content:{valignToJustify(el.style.font.valign)};{fontToCss({
		...el.style.font,
		color: STICKY_TEXT_COLOR
	})}"
>
	{#if !editing}<div>{el.text}</div>{/if}
</div>
