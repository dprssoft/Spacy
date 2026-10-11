<script lang="ts">
	import Segmented from '../../style/controls/Segmented.svelte';
	import { getBoard } from '../../context';
	import { selectedTexts } from '../selectionText';
	import { chip, field, legend } from '../settingsStyles';
	import type { WidgetSettingsProps } from '../ui';
	import { MAX_ITEMS, randomizerKind, type RandomizerConfig } from './randomizer';

	let { el, setConfig, disabled }: WidgetSettingsProps = $props();

	const ctx = getBoard();
	const config = $derived(randomizerKind.parseConfig(el.config));
	const fromSelection = $derived(selectedTexts(ctx).map((s) => s.slice(0, 100)));

	function set(patch: Partial<RandomizerConfig>) {
		setConfig({ ...config, ...patch });
	}
	const setItems = (items: string[]) => set({ items: items.slice(0, MAX_ITEMS) });
	const parseLines = (s: string) =>
		s
			.split('\n')
			.map((l) => l.trim().slice(0, 100))
			.filter(Boolean);
</script>

<label class="flex flex-col gap-1">
	<span class={legend}>Items, one per line ({config.items.length})</span>
	<textarea
		class="{field} h-32 resize-y py-1.5"
		value={config.items.join('\n')}
		{disabled}
		data-testid="randomizer-items"
		onchange={(e) => setItems(parseLines(e.currentTarget.value))}></textarea>
</label>
<div>
	<button
		type="button"
		class={chip}
		disabled={disabled || fromSelection.length === 0}
		title={fromSelection.length === 0 ? 'Select notes, shapes or texts first' : ''}
		onclick={() => setItems(fromSelection)}
		>Use selected{fromSelection.length ? ` (${fromSelection.length})` : ''}</button
	>
</div>

<Segmented
	label="What to do"
	value={config.mode}
	options={[
		{ value: 'pick', label: 'Pick', text: 'Pick' },
		{ value: 'shuffle', label: 'Shuffle', text: 'Shuffle' },
		{ value: 'teams', label: 'Teams', text: 'Teams' }
	]}
	onchange={(mode) =>
		!disabled && set({ mode, count: mode === 'teams' ? Math.max(2, config.count) : config.count })}
/>

{#if config.mode !== 'shuffle'}
	<label class="flex items-center justify-between gap-2 text-sm">
		{config.mode === 'teams' ? 'Number of teams' : 'How many to pick'}
		<input
			class="{field} w-20"
			type="number"
			min={config.mode === 'teams' ? 2 : 1}
			max="50"
			value={config.count}
			{disabled}
			onchange={(e) => {
				const v = Math.round(e.currentTarget.valueAsNumber);
				if (Number.isFinite(v))
					set({ count: Math.min(50, Math.max(config.mode === 'teams' ? 2 : 1, v)) });
			}}
		/>
	</label>
{/if}
