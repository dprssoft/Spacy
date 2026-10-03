<script lang="ts">
	import { Dialog } from 'bits-ui';
	import {
		searchTemplates,
		TEMPLATE_CATEGORIES,
		templates,
		type Template,
		type TemplateCategory
	} from '$lib/templates';

	let {
		open = $bindable(false),
		title = 'Templates',
		onpick
	}: {
		open?: boolean;
		title?: string;
		/** Called with the chosen template; the gallery closes first. */
		onpick: (t: Template) => void;
	} = $props();

	let query = $state('');
	let category = $state<TemplateCategory | null>(null);
	let previews = $state<Record<string, string>>({});
	let grid = $state<HTMLElement>();

	const shown = $derived(searchTemplates(query, category));
	const categories = TEMPLATE_CATEGORIES.filter((c) => templates.some((t) => t.category === c));

	// Previews are rendered in memory on first open and cached for the session.
	$effect(() => {
		if (!open) return;
		let alive = true;
		void import('$lib/templates/preview').then(({ templatePreview }) => {
			for (const t of templates)
				void templatePreview(t)
					.then((url) => {
						if (alive) previews[t.id] = url;
					})
					.catch((err: unknown) => console.error('Template preview failed', err));
		});
		return () => {
			alive = false;
		};
	});

	$effect(() => {
		if (!open) {
			query = '';
			category = null;
		}
	});

	function pick(t: Template) {
		open = false;
		onpick(t);
	}

	/** Arrow keys move between cards (rows follow the grid's column count). */
	function onGridKeydown(e: KeyboardEvent) {
		const cards = [...(grid?.querySelectorAll<HTMLButtonElement>('[data-template-card]') ?? [])];
		const i = cards.indexOf(document.activeElement as HTMLButtonElement);
		if (i < 0 || !grid) return;
		const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
		const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
		if (!step) return;
		e.preventDefault();
		cards[Math.min(cards.length - 1, Math.max(0, i + step))]?.focus();
	}

	const chip =
		'h-7 rounded-full border border-border px-3 text-xs font-medium hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none aria-pressed:border-accent aria-pressed:bg-accent/10 aria-pressed:text-accent';
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 flex max-h-[86dvh] w-[min(94vw,880px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-border bg-surface shadow-xl"
		>
			<div class="flex items-center gap-3 border-b border-border px-5 py-3">
				<Dialog.Title class="text-base font-semibold">{title}</Dialog.Title>
				<input
					bind:value={query}
					type="text"
					role="searchbox"
					aria-label="Search templates"
					placeholder="Search…"
					class="ml-auto h-8 w-56 rounded-md border border-border bg-bg px-2 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
				/>
				<Dialog.Close
					class="h-8 rounded-md px-2 text-sm text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
					>Close</Dialog.Close
				>
			</div>
			<Dialog.Description class="sr-only">
				Pick a template. Type to search, or filter by category.
			</Dialog.Description>
			<div class="flex flex-wrap gap-2 px-5 pt-3" role="group" aria-label="Categories">
				<button
					type="button"
					class={chip}
					aria-pressed={category === null}
					onclick={() => (category = null)}>All</button
				>
				{#each categories as c (c)}
					<button
						type="button"
						class={chip}
						aria-pressed={category === c}
						onclick={() => (category = c)}>{c}</button
					>
				{/each}
			</div>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				bind:this={grid}
				onkeydown={onGridKeydown}
				class="grid min-h-0 auto-rows-max grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 overflow-y-auto p-5"
			>
				{#each shown as t (t.id)}
					<button
						type="button"
						data-template-card={t.id}
						aria-label="{t.name} template"
						onclick={() => pick(t)}
						class="flex flex-col overflow-hidden rounded-xl border border-border bg-surface text-left transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
					>
						<div class="h-32 shrink-0 bg-white">
							{#if previews[t.id]}
								<img
									src={previews[t.id]}
									alt=""
									class="size-full object-contain p-1"
									draggable="false"
								/>
							{:else}
								<div class="size-full animate-pulse bg-surface-2" aria-hidden="true"></div>
							{/if}
						</div>
						<div class="border-t border-border px-3 py-2">
							<p class="truncate text-sm font-medium">{t.name}</p>
							<p class="truncate text-xs text-muted">{t.description}</p>
						</div>
					</button>
				{:else}
					<p class="col-span-full py-8 text-center text-sm text-muted">No templates match.</p>
				{/each}
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
