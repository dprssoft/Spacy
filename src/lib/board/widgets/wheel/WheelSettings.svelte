<script lang="ts">
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import X from '@lucide/svelte/icons/x';
	import { getBoard } from '../../context';
	import { selectedTexts } from '../selectionText';
	import { chip, field, iconButton, legend } from '../settingsStyles';
	import type { WidgetSettingsProps } from '../ui';
	import { MAX_SEGMENTS, segmentsFrom, WHEEL_COLORS, wheelKind, type WheelConfig } from './wheel';

	let { el, setConfig, disabled }: WidgetSettingsProps = $props();

	const ctx = getBoard();
	const config = $derived(wheelKind.parseConfig(el.config));
	const fromSelection = $derived(selectedTexts(ctx).slice(0, MAX_SEGMENTS));
	const PRESETS: { label: string; labels: () => string[] }[] = [
		{ label: 'Yes / No', labels: () => ['Yes', 'No'] },
		{ label: '1–10', labels: () => Array.from({ length: 10 }, (_, i) => String(i + 1)) },
		{ label: 'Team members', labels: () => Array.from({ length: 6 }, () => '') }
	];

	function set(patch: Partial<WheelConfig>) {
		setConfig({ ...config, ...patch });
	}
	function setSegments(segments: WheelConfig['segments']) {
		if (segments.length >= 2 && segments.length <= MAX_SEGMENTS) set({ segments });
	}
	const update = (i: number, patch: Partial<WheelConfig['segments'][number]>) =>
		setSegments(config.segments.map((s, j) => (j === i ? { ...s, ...patch } : s)));
	function move(i: number, d: -1 | 1) {
		const next = [...config.segments];
		[next[i], next[i + d]] = [next[i + d]!, next[i]!];
		setSegments(next);
	}
</script>

<fieldset class="flex min-w-0 flex-col gap-1" {disabled}>
	<legend class={legend}>Segments ({config.segments.length})</legend>
	<ul class="flex max-h-56 flex-col gap-1 overflow-y-auto pr-1" data-testid="wheel-segments">
		{#each config.segments as seg, i (i)}
			<li class="flex items-center gap-1">
				<input
					type="color"
					class="size-7 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
					aria-label="Color of segment {i + 1}"
					value={seg.color}
					onchange={(e) => update(i, { color: e.currentTarget.value })}
				/>
				<input
					class="{field} min-w-0 flex-1"
					aria-label="Segment {i + 1}"
					maxlength="60"
					value={seg.label}
					placeholder="Name"
					onchange={(e) => update(i, { label: e.currentTarget.value })}
				/>
				<button
					type="button"
					class={iconButton}
					aria-label="Move segment {i + 1} up"
					disabled={i === 0}
					onclick={() => move(i, -1)}><ArrowUp class="size-3.5" aria-hidden="true" /></button
				>
				<button
					type="button"
					class={iconButton}
					aria-label="Move segment {i + 1} down"
					disabled={i === config.segments.length - 1}
					onclick={() => move(i, 1)}><ArrowDown class="size-3.5" aria-hidden="true" /></button
				>
				<button
					type="button"
					class={iconButton}
					aria-label="Remove segment {i + 1}"
					disabled={config.segments.length <= 2}
					onclick={() => setSegments(config.segments.filter((_, j) => j !== i))}
					><X class="size-3.5" aria-hidden="true" /></button
				>
			</li>
		{/each}
	</ul>
	<div class="flex flex-wrap gap-1">
		<button
			type="button"
			class={chip}
			disabled={config.segments.length >= MAX_SEGMENTS}
			onclick={() =>
				setSegments([
					...config.segments,
					{
						label: `Option ${config.segments.length + 1}`,
						color: WHEEL_COLORS[config.segments.length % WHEEL_COLORS.length]!
					}
				])}>Add segment</button
		>
		<button
			type="button"
			class={chip}
			disabled={fromSelection.length < 2}
			title={fromSelection.length < 2 ? 'Select two or more notes, shapes or texts first' : ''}
			onclick={() => setSegments(segmentsFrom(fromSelection))}
			>Use selected{fromSelection.length >= 2 ? ` (${fromSelection.length})` : ''}</button
		>
	</div>
</fieldset>

<fieldset class="flex min-w-0 flex-wrap gap-1" {disabled}>
	<legend class={legend}>Presets</legend>
	{#each PRESETS as p (p.label)}
		<button type="button" class={chip} onclick={() => setSegments(segmentsFrom(p.labels()))}
			>{p.label}</button
		>
	{/each}
</fieldset>

<label class="flex items-center gap-2 text-sm">
	<input
		type="checkbox"
		checked={config.removeWinner}
		{disabled}
		onchange={(e) => set({ removeWinner: e.currentTarget.checked })}
	/>
	Remove the winner from the next spins
</label>

<label class="flex items-center justify-between gap-2 text-sm">
	Spin length
	<select
		class={field}
		value={config.duration}
		{disabled}
		onchange={(e) => set({ duration: Number(e.currentTarget.value) })}
	>
		{#each [2, 3, 4, 6, 8, 10] as s (s)}
			<option value={s}>{s} s</option>
		{/each}
	</select>
</label>
