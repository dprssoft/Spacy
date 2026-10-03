<script lang="ts">
	import Clock from '@lucide/svelte/icons/clock';
	import Star from '@lucide/svelte/icons/star';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { resolve } from '$app/paths';
	import type { BoardFilter } from '$lib/storage/types';
	import BackupButton from './BackupButton.svelte';
	import { VIEWS } from './views';

	let { active }: { active: BoardFilter } = $props();

	const icons = { recent: Clock, starred: Star, all: LayoutGrid, trash: Trash2 };
</script>

<!-- Vertical sidebar from md up; a horizontal tab row on small screens. -->
<nav
	aria-label="Board views"
	class="flex shrink-0 flex-col border-b border-border bg-surface md:w-56 md:border-r md:border-b-0 md:py-3"
>
	<ul
		class="flex gap-1 overflow-x-auto px-3 py-2 max-sm:grid max-sm:grid-cols-4 max-sm:px-2 md:flex-col md:px-2 md:py-0"
	>
		{#each VIEWS as view (view.id)}
			{@const Icon = icons[view.id]}
			<li>
				<a
					href={resolve(`/?view=${view.id}`)}
					aria-current={active === view.id ? 'page' : undefined}
					class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap text-muted transition-colors hover:bg-surface-2 hover:text-text aria-[current=page]:bg-surface-2 aria-[current=page]:font-medium aria-[current=page]:text-text max-sm:min-h-11 max-sm:flex-col max-sm:justify-center max-sm:gap-0.5 max-sm:px-1 max-sm:text-xs"
				>
					<Icon class="size-4" aria-hidden="true" />
					{view.label}
				</a>
			</li>
		{/each}
	</ul>
	<div class="mt-auto hidden px-2 md:block">
		<BackupButton />
	</div>
</nav>
