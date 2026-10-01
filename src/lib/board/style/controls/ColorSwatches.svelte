<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import { MIXED, type Mixed } from '../options';

	let {
		value,
		colors,
		label,
		onchange,
		allowCustom = true
	}: {
		value: string | Mixed;
		colors: readonly { value: string; name: string }[];
		label: string;
		onchange: (color: string) => void;
		allowCustom?: boolean;
	} = $props();

	const isPreset = $derived(value === MIXED || colors.some((c) => c.value === value));
	const checker =
		'background-image: conic-gradient(#ccc 25%, #fff 0 50%, #ccc 0 75%, #fff 0); background-size: 8px 8px;';
</script>

<div role="radiogroup" aria-label={label} class="grid grid-cols-6 gap-1.5">
	{#each colors as c (c.value)}
		{@const checked = value === c.value}
		<button
			type="button"
			role="radio"
			aria-checked={checked}
			aria-label={c.name}
			title={c.name}
			onclick={() => onchange(c.value)}
			class="size-6 rounded-md border border-border transition focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none aria-checked:ring-2 aria-checked:ring-accent aria-checked:ring-offset-1 aria-checked:ring-offset-surface"
			style={c.value === 'transparent' ? checker : `background:${c.value}`}
		></button>
	{/each}
	{#if allowCustom}
		<label
			class="relative flex size-6 cursor-pointer items-center justify-center rounded-md border border-dashed border-border text-muted focus-within:ring-2 focus-within:ring-accent"
			class:ring-2={!isPreset}
			class:ring-accent={!isPreset}
			title="Custom color"
			style={!isPreset && typeof value === 'string' ? `background:${value}` : ''}
		>
			{#if isPreset}<Plus class="size-3.5" aria-hidden="true" />{/if}
			<input
				type="color"
				aria-label="Custom color"
				class="absolute inset-0 cursor-pointer opacity-0"
				value={typeof value === 'string' && value.startsWith('#') && value.length === 7
					? value
					: '#000000'}
				onchange={(e) => onchange(e.currentTarget.value)}
			/>
		</label>
	{/if}
</div>
