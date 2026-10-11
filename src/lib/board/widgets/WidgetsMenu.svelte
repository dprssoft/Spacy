<script lang="ts">
	import { DropdownMenu, Tooltip } from 'bits-ui';
	import Puzzle from '@lucide/svelte/icons/puzzle';
	import { getBoard } from '../context';
	import { WIDGET_ICONS } from './ui';
	import WidgetMenuItems from './WidgetMenuItems.svelte';

	// The toolbar's Widgets flyout (built like Shapes): pick a kind, then click to place it.
	let { button, tip, item }: { button: string; tip: string; item: string } = $props();

	const { tools } = getBoard();
	const Icon = $derived(WIDGET_ICONS[tools.widgetKind] ?? Puzzle);

	function pick(kind: string) {
		tools.widgetKind = kind;
		tools.setTool('widget');
	}
</script>

<DropdownMenu.Root>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props: tipProps })}
				<DropdownMenu.Trigger {...tipProps}>
					{#snippet child({ props })}
						<button
							{...props}
							type="button"
							class="{button} max-sm:hidden"
							aria-label="Widgets"
							aria-haspopup="menu"
							data-tool="widget"
							aria-pressed={tools.current === 'widget'}
						>
							<Icon class="size-[18px]" aria-hidden="true" />
							<span
								class="absolute right-0.5 bottom-0.5 size-0 border-4 border-transparent border-r-current border-b-current opacity-50"
								aria-hidden="true"
							></span>
						</button>
					{/snippet}
				</DropdownMenu.Trigger>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Portal>
			<Tooltip.Content side="bottom" sideOffset={6} class={tip}>Widgets</Tooltip.Content>
		</Tooltip.Portal>
	</Tooltip.Root>
	<DropdownMenu.Portal>
		<DropdownMenu.Content
			side="bottom"
			align="start"
			sideOffset={6}
			data-interactive
			data-testid="widgets-menu"
			class="z-50 min-w-48 rounded-lg border border-border bg-surface p-1 shadow-lg"
		>
			<WidgetMenuItems {item} onpick={pick} />
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
