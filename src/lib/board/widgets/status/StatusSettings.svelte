<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import { chip, field, iconButton, legend } from '../settingsStyles';
	import type { WidgetSettingsProps } from '../ui';
	import {
		MAX_OPTIONS,
		MAX_STATUS_LABEL,
		MIN_OPTIONS,
		STATUS_COLORS,
		statusKind,
		withOptions,
		type StatusOption
	} from './status';

	let { el, setConfig, disabled }: WidgetSettingsProps = $props();

	const config = $derived(statusKind.parseConfig(el.config));

	function setOptions(options: StatusOption[]) {
		if (options.length >= MIN_OPTIONS && options.length <= MAX_OPTIONS)
			setConfig(withOptions(config, options));
	}
	const update = (i: number, patch: Partial<StatusOption>) =>
		setOptions(config.options.map((o, j) => (j === i ? { ...o, ...patch } : o)));
	function remove(i: number) {
		const options = config.options.filter((_, j) => j !== i);
		// Removing an option before the current one keeps the same option selected.
		const value = i < config.value ? config.value - 1 : config.value;
		if (options.length >= MIN_OPTIONS) setConfig(withOptions({ ...config, value }, options));
	}
	function add() {
		const color = STATUS_COLORS[config.options.length % STATUS_COLORS.length]!;
		setOptions([...config.options, { label: `Option ${config.options.length + 1}`, color }]);
	}
</script>

<fieldset class="flex min-w-0 flex-col gap-1" {disabled}>
	<legend class={legend}>Options</legend>
	<ul class="flex flex-col gap-1" data-testid="status-options">
		{#each config.options as option, i (i)}
			<li class="flex items-center gap-1">
				<input
					type="color"
					class="size-7 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
					aria-label="Color of {option.label}"
					value={option.color}
					onchange={(e) => update(i, { color: e.currentTarget.value })}
				/>
				<input
					class="{field} min-w-0 flex-1"
					aria-label="Option {i + 1}"
					maxlength={MAX_STATUS_LABEL}
					value={option.label}
					onchange={(e) => {
						const label = e.currentTarget.value.trim();
						if (label) update(i, { label });
						else e.currentTarget.value = option.label;
					}}
				/>
				<button
					type="button"
					class={iconButton}
					aria-label="Show {option.label}"
					aria-pressed={config.value === i}
					onclick={() => setConfig({ ...config, value: i })}
					><Check
						class="size-3.5 {config.value === i ? 'text-accent' : 'opacity-30'}"
						aria-hidden="true"
					/></button
				>
				<button
					type="button"
					class={iconButton}
					aria-label="Remove {option.label}"
					disabled={config.options.length <= MIN_OPTIONS}
					onclick={() => remove(i)}><X class="size-3.5" aria-hidden="true" /></button
				>
			</li>
		{/each}
	</ul>
	<div>
		<button type="button" class={chip} disabled={config.options.length >= MAX_OPTIONS} onclick={add}
			>Add option</button
		>
	</div>
</fieldset>
