<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createBoardFromTemplate, type Template } from '$lib/templates';

	let { template, preview }: { template: Template; preview: string | null } = $props();

	let pending = $state(false);

	async function create() {
		if (pending) return;
		pending = true;
		try {
			const meta = await createBoardFromTemplate(template);
			await goto(resolve('/board/[id]', { id: meta.id }));
		} catch (err) {
			console.error(err);
			toast.error('Couldn’t create the board');
		} finally {
			pending = false;
		}
	}
</script>

<button
	type="button"
	onclick={create}
	disabled={pending}
	aria-label="{template.name} template"
	data-template={template.id}
	class="group flex aspect-[16/10] flex-col overflow-hidden rounded-xl border border-border bg-surface text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none disabled:opacity-60"
>
	<div class="min-h-0 flex-1 bg-white">
		{#if preview}
			<img src={preview} alt="" class="size-full object-contain p-1" draggable="false" />
		{:else}
			<div class="size-full animate-pulse bg-surface-2" aria-hidden="true"></div>
		{/if}
	</div>
	<div class="border-t border-border px-3 py-2">
		<p class="truncate text-sm font-medium">{pending ? 'Creating…' : template.name}</p>
		<p class="truncate text-xs text-muted">{template.description}</p>
	</div>
</button>
