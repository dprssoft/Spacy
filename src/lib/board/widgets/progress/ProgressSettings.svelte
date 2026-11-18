<script lang="ts">
	import { getBoard } from '../../context';
	import { chip, legend } from '../settingsStyles';
	import type { WidgetSettingsProps } from '../ui';
	import { PROGRESS_COLORS, progressKind, type ProgressConfig } from './progress';

	let { el, setConfig, disabled }: WidgetSettingsProps = $props();

	const ctx = getBoard();
	const config = $derived(progressKind.parseConfig(el.config));
	const set = (patch: Partial<ProgressConfig>) => setConfig({ ...config, ...patch });
	const selectedCard = $derived.by(() => {
		const id = ctx.selection.single;
		const e = id && id !== el.id ? ctx.store.get(id) : undefined;
		return e?.type === 'doccard' ? e : null;
	});
	const linked = $derived.by(() => {
		const e = config.cardId ? ctx.store.get(config.cardId) : undefined;
		return e?.type === 'doccard' ? e : null;
	});
</script>

<fieldset class="flex min-w-0 flex-wrap gap-1" {disabled}>
	<legend class={legend}>Counts</legend>
	<button
		type="button"
		class={chip}
		aria-pressed={config.source === 'manual'}
		onclick={() => set({ source: 'manual' })}>Set by hand</button
	>
	<button
		type="button"
		class={chip}
		aria-pressed={config.source === 'checklist'}
		data-testid="progress-checklist"
		onclick={() => set({ source: 'checklist' })}>Doc card checklist</button
	>
</fieldset>

{#if config.source === 'manual'}
	<label class="flex items-center justify-between gap-3 text-sm">
		Progress
		<input
			type="range"
			class="min-w-0 flex-1 accent-accent"
			min="0"
			max="100"
			step="1"
			value={config.value}
			{disabled}
			data-testid="progress-value"
			onchange={(e) => set({ value: Number(e.currentTarget.value) })}
		/>
		<span class="w-10 text-right tabular-nums">{Math.round(config.value)}%</span>
	</label>
{:else}
	<div class="flex flex-col gap-1 text-sm">
		<span class="truncate text-muted" data-testid="progress-linked">
			{linked ? `Linked: ${linked.title || 'Untitled doc card'}` : 'No doc card linked'}
		</span>
		<div class="flex flex-wrap gap-1">
			<button
				type="button"
				class={chip}
				disabled={disabled || !selectedCard}
				title={selectedCard ? undefined : 'Select a doc card first, or drop the widget on one'}
				onclick={() => selectedCard && set({ cardId: selectedCard.id })}
				>Use selected doc card</button
			>
			{#if config.cardId}
				<button type="button" class={chip} {disabled} onclick={() => set({ cardId: null })}
					>Unlink</button
				>
			{/if}
		</div>
	</div>
{/if}

<fieldset class="flex min-w-0 flex-wrap gap-1" {disabled}>
	<legend class={legend}>Look</legend>
	<button
		type="button"
		class={chip}
		aria-pressed={config.look === 'bar'}
		onclick={() => set({ look: 'bar' })}>Bar</button
	>
	<button
		type="button"
		class={chip}
		aria-pressed={config.look === 'ring'}
		onclick={() => set({ look: 'ring' })}>Ring</button
	>
</fieldset>

<fieldset class="flex min-w-0 flex-wrap gap-1.5" {disabled}>
	<legend class={legend}>Color</legend>
	{#each PROGRESS_COLORS as color (color)}
		<button
			type="button"
			class="size-6 rounded-full border-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-50 {config.color ===
			color
				? 'border-text'
				: 'border-transparent'}"
			style:background-color={color}
			aria-label="Color {color}"
			aria-pressed={config.color === color}
			onclick={() => set({ color })}
		></button>
	{/each}
</fieldset>
