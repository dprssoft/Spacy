<script lang="ts">
	import { DEFAULT_FONT, FONT_CATEGORIES, pickableFonts } from '$lib/fonts/catalog';
	import type { Mixed } from '../options';

	let {
		value,
		onchange
	}: {
		/** A font id; missing means the default font. */
		value: string | undefined | Mixed;
		onchange: (id: string) => void;
	} = $props();

	const current = $derived(value === undefined ? DEFAULT_FONT : value);
	const fonts = $derived(pickableFonts(typeof current === 'string' ? current : null));
</script>

<!-- Each name is shown in its own font. It keeps its height in a short panel, which scrolls
     instead: squeezed, it showed two fonts and hid the rest. -->
<div
	role="radiogroup"
	aria-label="Font"
	class="flex max-h-56 w-56 shrink-0 flex-col overflow-y-auto pr-1"
>
	{#each FONT_CATEGORIES as category (category)}
		<span class="px-2 pt-1.5 pb-0.5 text-[11px] text-muted">{category}</span>
		{#each fonts.filter((f) => f.category === category) as f (f.id)}
			<button
				type="button"
				role="radio"
				aria-checked={current === f.id}
				data-font-id={f.id}
				class="flex h-8 shrink-0 items-center rounded-md px-2 text-left text-[15px] text-text hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none aria-checked:bg-accent/15 aria-checked:text-accent"
				style:font-family={f.stack}
				onclick={() => onchange(f.id)}
			>
				{f.label}
			</button>
		{/each}
	{/each}
</div>
