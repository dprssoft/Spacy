<script lang="ts">
	import { Tooltip } from 'bits-ui';
	import Sun from '@lucide/svelte/icons/sun';
	import Moon from '@lucide/svelte/icons/moon';
	import Monitor from '@lucide/svelte/icons/monitor';
	import { theme, type ThemeMode } from '$lib/shared/theme.svelte';

	const icons = { light: Sun, dark: Moon, system: Monitor };
	const labels: Record<ThemeMode, string> = { light: 'Light', dark: 'Dark', system: 'System' };

	const Icon = $derived(icons[theme.mode]);
</script>

<Tooltip.Root>
	<Tooltip.Trigger
		class="inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
		aria-label="Theme: {labels[theme.mode]}"
		onclick={() => theme.cycle()}
	>
		<Icon class="size-[18px]" aria-hidden="true" />
	</Tooltip.Trigger>
	<Tooltip.Portal>
		<Tooltip.Content
			sideOffset={6}
			class="z-50 rounded-md bg-text px-2 py-1 text-xs font-medium text-bg shadow-md"
		>
			Theme: {labels[theme.mode]}
		</Tooltip.Content>
	</Tooltip.Portal>
</Tooltip.Root>
