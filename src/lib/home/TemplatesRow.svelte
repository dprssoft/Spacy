<script lang="ts">
	import { templates } from '$lib/templates';
	import NewBoardCard from './NewBoardCard.svelte';
	import TemplateCard from './TemplateCard.svelte';

	let section = $state<HTMLElement>();
	let previews = $state<Record<string, string>>({});

	// Previews are built in memory the first time the row is on screen (cached for the session).
	$effect(() => {
		if (!section) return;
		let alive = true;
		const observer = new IntersectionObserver((entries) => {
			if (!entries.some((e) => e.isIntersecting)) return;
			observer.disconnect();
			void import('$lib/templates/preview').then(({ templatePreview }) => {
				for (const t of templates)
					void templatePreview(t)
						.then((url) => {
							if (alive) previews[t.id] = url;
						})
						.catch((err: unknown) => console.error('Template preview failed', err));
			});
		});
		observer.observe(section);
		return () => {
			alive = false;
			observer.disconnect();
		};
	});
</script>

<section
	bind:this={section}
	aria-label="Create"
	class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4"
>
	<NewBoardCard />
	{#each templates as template (template.id)}
		<TemplateCard {template} preview={previews[template.id] ?? null} />
	{/each}
</section>
