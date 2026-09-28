<script lang="ts">
	import { Tooltip } from 'bits-ui';
	import CloudCheck from '@lucide/svelte/icons/cloud-check';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { LOCAL } from '$lib/model/origins';
	import { getBoard } from './context';

	const { doc } = getBoard();
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
		class="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
	>
		{#if saving}
			<LoaderCircle class="size-3.5 animate-spin" aria-hidden="true" />
			<span aria-live="polite">Saving…</span>
		{:else}
			<CloudCheck class="size-3.5" aria-hidden="true" />
			<span aria-live="polite">Saved locally</span>
		{/if}
	</Tooltip.Trigger>
	<Tooltip.Portal>
		<Tooltip.Content
			sideOffset={6}
			class="z-50 max-w-60 rounded-md bg-text px-2 py-1.5 text-xs text-bg shadow-md"
		>
			Boards are saved in this browser. Export a backup to keep a copy.
		</Tooltip.Content>
	</Tooltip.Portal>
</Tooltip.Root>
