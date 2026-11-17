<script lang="ts">
	import { chip, field, legend } from '../settingsStyles';
	import type { WidgetSettingsProps } from '../ui';
	import { coinKind, DEFAULT_COIN, MAX_LABEL, type CoinConfig, type Side } from './coin';

	let { el, setConfig, disabled }: WidgetSettingsProps = $props();

	const config = $derived(coinKind.parseConfig(el.config));
	const PRESETS: CoinConfig[] = [DEFAULT_COIN, { heads: 'Yes', tails: 'No' }];

	function setSide(side: Side, value: string) {
		const v = value.trim().slice(0, MAX_LABEL);
		if (v) setConfig({ ...config, [side]: v });
	}
</script>

<fieldset class="flex min-w-0 flex-col gap-2" {disabled}>
	<legend class={legend}>Sides</legend>
	{#each [['heads', 'Front'] as const, ['tails', 'Back'] as const] as [side, name] (side)}
		<label class="flex items-center justify-between gap-2 text-sm">
			{name}
			<input
				class="{field} w-36"
				value={config[side]}
				maxlength={MAX_LABEL}
				data-testid="coin-{side}"
				onchange={(e) => setSide(side, e.currentTarget.value)}
			/>
		</label>
	{/each}
	<div class="flex flex-wrap gap-1">
		{#each PRESETS as p (p.heads)}
			<button
				type="button"
				class={chip}
				aria-pressed={config.heads === p.heads && config.tails === p.tails}
				onclick={() => setConfig({ ...p })}>{p.heads} / {p.tails}</button
			>
		{/each}
	</div>
</fieldset>
