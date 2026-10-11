<script lang="ts">
	import { chip, field, legend } from '../settingsStyles';
	import type { WidgetSettingsProps } from '../ui';
	import { diceKind, SIDES, type DiceConfig } from './dice';

	let { el, setConfig, disabled }: WidgetSettingsProps = $props();

	const config = $derived(diceKind.parseConfig(el.config));
	const set = (patch: Partial<DiceConfig>) => setConfig({ ...config, ...patch });
</script>

<fieldset class="flex min-w-0 flex-wrap gap-1" {disabled}>
	<legend class={legend}>Kind</legend>
	{#each SIDES as sides (sides)}
		<button
			type="button"
			class={chip}
			aria-pressed={config.sides === sides}
			onclick={() => set({ sides })}>{sides === 2 ? 'Coin' : `d${sides}`}</button
		>
	{/each}
</fieldset>

<label class="flex items-center justify-between gap-2 text-sm">
	How many
	<select
		class={field}
		value={config.count}
		{disabled}
		onchange={(e) => set({ count: Number(e.currentTarget.value) })}
	>
		{#each [1, 2, 3, 4, 5, 6] as c (c)}
			<option value={c}>{c}</option>
		{/each}
	</select>
</label>
