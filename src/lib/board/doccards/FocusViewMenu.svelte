<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import Eye from '@lucide/svelte/icons/eye';
	import { focusPrefs, type FocusPrefs } from '../writing/focusPrefs.svelte';

	let { class: className }: { class: string } = $props();

	const p = $derived(focusPrefs.value);
	const item =
		'flex h-8 pointer-coarse:h-11 cursor-default items-center gap-2 rounded-md px-2 text-sm outline-none select-none data-[highlighted]:bg-surface-2';
	const heading = 'px-2 pt-2 pb-1 text-xs font-medium text-muted';
	const toggles: [keyof FocusPrefs, string][] = [
		['typewriter', 'Typewriter scrolling'],
		['focusParagraph', 'Focus paragraph'],
		['hideUi', 'Hide interface']
	];
	const radios = [
		{
			key: 'width',
			label: 'Line width',
			options: [
				['narrow', 'Narrow'],
				['medium', 'Medium'],
				['wide', 'Wide']
			]
		},
		{
			key: 'font',
			label: 'Font',
			options: [
				['document', 'Document font'],
				['serif', 'Serif (Lora)']
			]
		},
		{
			key: 'size',
			label: 'Text size',
			options: [
				['s', 'Small'],
				['m', 'Medium'],
				['l', 'Large']
			]
		}
	] as const;
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger class={className} aria-label="View options">
		<Eye class="size-4" aria-hidden="true" />
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content
			align="end"
			sideOffset={4}
			data-interactive
			class="z-[60] min-w-56 rounded-lg border border-border bg-surface p-1 shadow-lg"
		>
			{#each toggles as [key, label] (key)}
				<DropdownMenu.CheckboxItem
					class={item}
					closeOnSelect={false}
					checked={p[key] as boolean}
					onCheckedChange={(v) => focusPrefs.set({ [key]: v })}
				>
					{#snippet children({ checked })}
						<span class="w-4 text-accent" aria-hidden="true">{checked ? '✓' : ''}</span>{label}
					{/snippet}
				</DropdownMenu.CheckboxItem>
			{/each}
			{#each radios as group (group.key)}
				<DropdownMenu.Separator class="my-1 h-px bg-border" />
				<DropdownMenu.RadioGroup
					value={p[group.key]}
					onValueChange={(v) => focusPrefs.set({ [group.key]: v } as Partial<FocusPrefs>)}
				>
					<DropdownMenu.GroupHeading class={heading}>{group.label}</DropdownMenu.GroupHeading>
					{#each group.options as [value, label] (value)}
						<DropdownMenu.RadioItem {value} class={item} closeOnSelect={false}>
							{#snippet children({ checked })}
								<span class="w-4 text-accent" aria-hidden="true">{checked ? '●' : ''}</span>{label}
							{/snippet}
						</DropdownMenu.RadioItem>
					{/each}
				</DropdownMenu.RadioGroup>
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
