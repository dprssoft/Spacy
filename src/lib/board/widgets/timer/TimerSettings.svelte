<script lang="ts">
	import Segmented from '../../style/controls/Segmented.svelte';
	import type { WidgetSettingsProps } from '../ui';
	import { TIMER_PRESETS_MIN, timerKind, type TimerConfig } from './timer';

	let { el, setConfig, disabled }: WidgetSettingsProps = $props();

	const config = $derived(timerKind.parseConfig(el.config));
	const minutes = $derived(Math.floor(config.duration / 60));
	const seconds = $derived(config.duration % 60);

	function set(patch: Partial<TimerConfig>) {
		setConfig({ ...config, ...patch });
	}

	function setDuration(m: number, s: number) {
		const total = Math.round((Number.isFinite(m) ? m : 0) * 60 + (Number.isFinite(s) ? s : 0));
		set({ duration: Math.min(86_400, Math.max(1, total)) });
	}

	const field =
		'h-8 w-16 rounded-md border border-border bg-bg px-2 text-sm tabular-nums focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-50';
	const chip =
		'h-7 rounded-md border border-border px-2 text-xs hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none aria-pressed:border-accent aria-pressed:text-accent disabled:opacity-50';
</script>

<Segmented
	label="Timer mode"
	value={config.mode}
	options={[
		{ value: 'countdown', label: 'Countdown', text: 'Countdown' },
		{ value: 'stopwatch', label: 'Stopwatch', text: 'Stopwatch' }
	]}
	onchange={(mode) => !disabled && set({ mode })}
/>

{#if config.mode === 'countdown'}
	<fieldset class="flex min-w-0 flex-col gap-2" {disabled}>
		<legend class="mb-1 text-xs font-medium text-muted">Duration</legend>
		<div class="flex items-center gap-2 text-sm">
			<label class="flex items-center gap-1">
				<input
					class={field}
					type="number"
					min="0"
					max="1440"
					value={minutes}
					data-testid="timer-minutes"
					onchange={(e) => setDuration(e.currentTarget.valueAsNumber, seconds)}
				/>
				min
			</label>
			<label class="flex items-center gap-1">
				<input
					class={field}
					type="number"
					min="0"
					max="59"
					value={seconds}
					onchange={(e) => setDuration(minutes, e.currentTarget.valueAsNumber)}
				/>
				s
			</label>
		</div>
		<div class="flex flex-wrap gap-1" role="group" aria-label="Presets">
			{#each TIMER_PRESETS_MIN as m (m)}
				<button
					type="button"
					class={chip}
					aria-pressed={config.duration === m * 60}
					onclick={() => set({ duration: m * 60 })}>{m} min</button
				>
			{/each}
		</div>
	</fieldset>
{/if}

<label class="flex items-center gap-2 text-sm">
	<input
		type="checkbox"
		checked={config.sound}
		{disabled}
		onchange={(e) => set({ sound: e.currentTarget.checked })}
	/>
	Sound when time is up
</label>
