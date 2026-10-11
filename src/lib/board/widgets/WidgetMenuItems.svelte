<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { allWidgetKinds, WIDGET_GROUPS } from './index';
	import { WIDGET_DRAG_TYPE } from './create';
	import { WIDGET_ICONS } from './ui';
	import Puzzle from '@lucide/svelte/icons/puzzle';

	// The widget kinds by work direction, for the toolbar's Widgets menu and the phones' Insert menu.
	let { item, onpick }: { item: string; onpick: (kind: string) => void } = $props();

	const kinds = allWidgetKinds();
</script>

{#each WIDGET_GROUPS.filter((g) => kinds.some((k) => k.group === g)) as group (group)}
	<DropdownMenu.Group>
		<DropdownMenu.GroupHeading class="px-2 pt-1.5 pb-0.5 text-xs font-medium text-muted"
			>{group}</DropdownMenu.GroupHeading
		>
		{#each kinds.filter((k) => k.group === group) as k (k.kind)}
			{@const Icon = WIDGET_ICONS[k.kind] ?? Puzzle}
			<DropdownMenu.Item
				class={item}
				draggable="true"
				data-widget-kind={k.kind}
				ondragstart={(e: DragEvent) => {
					e.dataTransfer?.setData(WIDGET_DRAG_TYPE, k.kind);
					if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
				}}
				onSelect={() => onpick(k.kind)}
			>
				<Icon class="size-4" aria-hidden="true" />
				<span class="flex-1">{k.label}</span>
			</DropdownMenu.Item>
		{/each}
	</DropdownMenu.Group>
{/each}
