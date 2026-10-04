<script lang="ts">
	import { Dialog } from 'bits-ui';
	import BacklinksList from './BacklinksList.svelte';
	import { backlinksDialog } from './backlinksDialogState.svelte';

	const open = $derived(backlinksDialog.targetId !== null);
</script>

<Dialog.Root {open} onOpenChange={(v) => !v && (backlinksDialog.targetId = null)}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/30" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-3 shadow-xl"
		>
			<Dialog.Title class="px-2 pb-2 text-sm font-semibold">Mentioned in</Dialog.Title>
			{#if backlinksDialog.targetId}
				<BacklinksList
					targetId={backlinksDialog.targetId}
					onpick={() => (backlinksDialog.targetId = null)}
				/>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
