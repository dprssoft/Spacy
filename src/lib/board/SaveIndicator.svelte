<script lang="ts">
	import { Tooltip } from 'bits-ui';
	import CloudCheck from '@lucide/svelte/icons/cloud-check';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { LOCAL } from '$lib/model/origins';
	import { getBoard } from './context';

	const { doc, save } = getBoard();
	let saving = $state(false);

	$effect(() => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const onUpdate = (_u: Uint8Array, origin: unknown) => {
			if (origin !== LOCAL) return;
			saving = true;
			clearTimeout(timer);
			timer = setTimeout(() => (saving = false), 600);
		};
		doc.on('update', onUpdate);
		return () => {
			doc.off('update', onUpdate);
			clearTimeout(timer);
		};
	});
</script>

<Tooltip.Root>
	<Tooltip.Trigger
		class="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none data-[failed]:font-medium data-[failed]:text-danger data-[failed]:hover:bg-surface"
		data-failed={save.failed || undefined}
		data-testid="save-indicator"
		onclick={() => {
			if (save.failed) void save.retry();
		}}
	>
		{#if save.failed}
			{#if save.retrying}
				<LoaderCircle class="size-3.5 animate-spin" aria-hidden="true" />
			{:else}
				<TriangleAlert class="size-3.5" aria-hidden="true" />
			{/if}
			<span role="alert" class="max-sm:sr-only">Not saved</span>
		{:else if saving}
			<LoaderCircle class="size-3.5 animate-spin" aria-hidden="true" />
			<span aria-live="polite" class="max-sm:sr-only">Saving…</span>
		{:else}
			<CloudCheck class="size-3.5" aria-hidden="true" />
			<span aria-live="polite" class="max-sm:sr-only">Saved locally</span>
		{/if}
	</Tooltip.Trigger>
	<Tooltip.Portal>
		<Tooltip.Content
			sideOffset={6}
			class="z-50 max-w-60 rounded-md bg-text px-2 py-1.5 text-xs text-bg shadow-md"
		>
			{#if save.failed}
				Changes aren’t reaching browser storage (it may be full). Click to retry, or download a copy
				from the menu.
			{:else}
				Boards are saved in this browser. Export a backup to keep a copy.
			{/if}
		</Tooltip.Content>
	</Tooltip.Portal>
</Tooltip.Root>
