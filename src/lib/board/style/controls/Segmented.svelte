<script lang="ts" generics="T extends string | number">
	import type { Component } from 'svelte';
	import type { Mixed } from '../options';

	type IconComponent = Component<{ class?: string }>;

	let {
		value,
		options,
		label,
		onchange
	}: {
		value: T | Mixed;
		options: readonly { value: T; label: string; icon?: IconComponent; text?: string }[];
		label: string;
		onchange: (value: T) => void;
	} = $props();

	let group = $state<HTMLDivElement>();
	// One tab stop: the checked option, or the first one when nothing (or a mixed value) is checked.
	const noneChecked = $derived(!options.some((o) => o.value === value));

	function onkeydown(e: KeyboardEvent) {
		const dir =
			e.key === 'ArrowRight' || e.key === 'ArrowDown'
				? 1
				: e.key === 'ArrowLeft' || e.key === 'ArrowUp'
					? -1
					: 0;
		if (!dir) return;
		e.preventDefault();
		const i = Math.max(
			0,
			options.findIndex((o) => o.value === value)
		);
		const next = options[(i + dir + options.length) % options.length]!;
		onchange(next.value);
		group?.querySelectorAll<HTMLButtonElement>('[role=radio]')[options.indexOf(next)]?.focus();
	}
</script>

<div
	bind:this={group}
	role="radiogroup"
	aria-label={label}
	tabindex="-1"
	{onkeydown}
	class="inline-flex rounded-lg bg-surface-2 p-0.5"
>
	{#each options as o, i (o.value)}
		{@const checked = value === o.value}
		<button
			type="button"
			role="radio"
			aria-checked={checked}
			aria-label={o.label}
			title={o.label}
			tabindex={checked || (noneChecked && i === 0) ? 0 : -1}
			onclick={() => onchange(o.value)}
			class="inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs font-medium text-muted transition hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none aria-checked:bg-surface aria-checked:text-text aria-checked:shadow-sm"
		>
			{#if o.icon}
				<o.icon class="size-4" />
			{:else}
				{o.text ?? o.label}
			{/if}
		</button>
	{/each}
</div>
