<script lang="ts">
	import LayoutTemplate from '@lucide/svelte/icons/layout-template';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createBoardFromTemplate, templates, type Template } from '$lib/templates';
	import NewBoardCard from './NewBoardCard.svelte';
	import TemplateCard from './TemplateCard.svelte';

	/** Previews of the featured templates, drawn at build time (see routes/+page.server.ts). */
	let { previews }: { previews: Record<string, string> } = $props();

	const featured = templates.filter((t) => t.featured);
	let galleryOpen = $state(false);
	let galleryWanted = $state(false);
	$effect(() => {
		if (galleryOpen) galleryWanted = true;
	});

	async function createFrom(t: Template) {
		try {
			const meta = await createBoardFromTemplate(t);
			await goto(resolve('/board/[id]', { id: meta.id }));
		} catch (err) {
			console.error(err);
			toast.error('Couldn’t create the board');
		}
	}
</script>

<section aria-label="Create" class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
	<NewBoardCard />
	{#each featured as template (template.id)}
		<TemplateCard {template} preview={previews[template.id] ?? null} />
	{/each}
	{#if featured.length < templates.length}
		<button
			type="button"
			onclick={() => (galleryOpen = true)}
			aria-haspopup="dialog"
			class="flex aspect-[16/10] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface text-sm font-medium text-muted transition hover:text-text hover:shadow-md focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none"
		>
			<LayoutTemplate class="size-6" aria-hidden="true" />
			More templates
		</button>
	{/if}
</section>

{#if galleryWanted}
	{#await import('$lib/shared/ui/TemplateGallery.svelte') then { default: TemplateGallery }}
		<TemplateGallery
			bind:open={galleryOpen}
			title="New board from a template"
			onpick={(t) => void createFrom(t)}
		/>
	{/await}
{/if}
