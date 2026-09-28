<script lang="ts">
	import type { Element } from '$lib/model/types';
	import type { ElementViewProps } from '../registry';

	// Stand-in for element types whose real view arrives in a later step.
	let { el }: ElementViewProps<Element> = $props();
</script>

<div
	class="absolute inset-0 flex items-center justify-center rounded-md border-2 border-dashed border-muted/60 text-xs text-muted"
>
	{el.type}
</div>
