<script lang="ts">
	import Pipette from '@lucide/svelte/icons/pipette';
	import type { Mixed } from '../options';
	import { ink } from '../../elements/common';
	import { normalizeHex, PALETTE_COLUMNS, type Swatch } from '../palette';
	import { recentColors } from '../recentColors.svelte';

	let {
		value,
		colors,
		label,
		onchange,
		allowCustom = true,
		followTheme = false
	}: {
		value: string | Mixed;
		colors: readonly Swatch[];
		label: string;
		onchange: (color: string) => void;
		allowCustom?: boolean;
		/** Paint the default ink as it renders on the board (light in dark mode). */
		followTheme?: boolean;
	} = $props();

	const current = $derived(typeof value === 'string' ? value.toLowerCase() : null);
	const recent = $derived(
		allowCustom ? recentColors.list.filter((c) => !colors.some((p) => p.value === c)) : []
	);
	let hex = $state('');
	let invalid = $state(false);

	function custom(color: string) {
		const c = normalizeHex(color);
		if (!c) {
			invalid = true;
			return;
		}
		recentColors.add(c);
		onchange(c);
	}

	const swatch =
		'size-5 rounded border border-border transition focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none aria-checked:ring-2 aria-checked:ring-accent aria-checked:ring-offset-1 aria-checked:ring-offset-surface';
	const checker =
		'background-image: conic-gradient(#ccc 25%, #fff 0 50%, #ccc 0 75%, #fff 0); background-size: 8px 8px;';
</script>

{#snippet swatchButton(c: Swatch)}
	<button
		type="button"
		role="radio"
		aria-checked={current === c.value}
		aria-label={c.name}
		title={c.name}
		data-color={c.value}
		onclick={() => onchange(c.value)}
		class={swatch}
		style={c.value === 'transparent'
			? checker
			: `background:${followTheme ? ink(c.value) : c.value}`}
	></button>
{/snippet}

<div class="flex flex-col gap-2">
	<div
		role="radiogroup"
		aria-label={label}
		class="grid gap-1"
		style:grid-template-columns="repeat({PALETTE_COLUMNS}, 1.25rem)"
	>
		{#each colors as c (c.value)}{@render swatchButton(c)}{/each}
	</div>
	{#if allowCustom}
		{#if recent.length > 0}
			<div class="flex flex-col gap-1">
				<span class="text-[11px] text-muted">Recent</span>
				<div role="radiogroup" aria-label="Recent colors" class="flex flex-wrap gap-1">
					{#each recent as c (c)}{@render swatchButton({ value: c, name: c })}{/each}
				</div>
			</div>
		{/if}
		<div class="flex items-center gap-1.5">
			<label
				class="relative inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border text-muted focus-within:ring-2 focus-within:ring-accent hover:bg-surface-2"
				title="Pick any color"
			>
				<Pipette class="size-3.5" aria-hidden="true" />
				<input
					type="color"
					aria-label="Pick any color"
					class="absolute inset-0 cursor-pointer opacity-0"
					value={current && normalizeHex(current) ? normalizeHex(current) : '#000000'}
					onchange={(e) => custom(e.currentTarget.value)}
				/>
			</label>
			<input
				type="text"
				bind:value={hex}
				placeholder={current && normalizeHex(current) ? current : '#rrggbb'}
				aria-label="Hex color"
				aria-invalid={invalid}
				spellcheck="false"
				class="h-7 w-24 min-w-0 rounded-md border border-border bg-surface px-2 font-mono text-xs text-text outline-none focus:border-accent aria-invalid:border-red-500"
				oninput={() => (invalid = false)}
				onkeydown={(e) => {
					if (e.key !== 'Enter') return;
					e.preventDefault();
					custom(hex);
				}}
			/>
		</div>
	{/if}
</div>
