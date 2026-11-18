<script lang="ts">
	import { chip, field } from '../settingsStyles';
	import type { WidgetSettingsProps } from '../ui';
	import { deadlineKind, MAX_DEADLINE_LABEL, type DeadlineConfig } from './deadline';

	let { el, setConfig, disabled }: WidgetSettingsProps = $props();

	const config = $derived(deadlineKind.parseConfig(el.config));
	const set = (patch: Partial<DeadlineConfig>) => setConfig({ ...config, ...patch });
</script>

<label class="flex items-center justify-between gap-2 text-sm">
	Label
	<input
		class="{field} w-40"
		value={config.label}
		maxlength={MAX_DEADLINE_LABEL}
		placeholder="Launch"
		{disabled}
		data-testid="deadline-label"
		onchange={(e) => set({ label: e.currentTarget.value.trim() })}
	/>
</label>
<label class="flex items-center justify-between gap-2 text-sm">
	Date
	<input
		type="date"
		class="{field} w-40"
		value={config.date}
		required
		{disabled}
		data-testid="deadline-date"
		onchange={(e) => {
			const date = e.currentTarget.value;
			if (date) set({ date });
			else e.currentTarget.value = config.date;
		}}
	/>
</label>
<div class="flex items-center justify-between gap-2 text-sm">
	<label for="deadline-time-{el.id}">Time</label>
	<div class="flex items-center gap-1">
		{#if config.time !== null}
			<button type="button" class={chip} {disabled} onclick={() => set({ time: null })}
				>End of day</button
			>
		{/if}
		<input
			id="deadline-time-{el.id}"
			type="time"
			class="{field} w-28"
			value={config.time ?? ''}
			{disabled}
			data-testid="deadline-time"
			onchange={(e) => set({ time: e.currentTarget.value || null })}
		/>
	</div>
</div>
