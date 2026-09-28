<script lang="ts">
	import NewBoardCard from './NewBoardCard.svelte';
	import type { TemplateCardData } from './views';

	// Templates arrive in step 28; until then only the "New board" card is shown.
	let { templates = [] }: { templates?: TemplateCardData[] } = $props();
</script>

<section aria-label="Create" class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
	<NewBoardCard />
	{#each templates as template (template.id)}
		<div class="rounded-xl border border-border bg-surface p-3 text-sm">{template.name}</div>
	{/each}
</section>
