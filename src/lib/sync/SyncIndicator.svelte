<script lang="ts">
	import Cloud from '@lucide/svelte/icons/cloud';
	import CloudAlert from '@lucide/svelte/icons/cloud-alert';
	import CloudOff from '@lucide/svelte/icons/cloud-off';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import { describeState } from './describe';
	import { driveSync } from './driveSync.svelte';
	import SyncDialog from './SyncDialog.svelte';

	let open = $state(false);
	const sync = $derived(driveSync.state);
	const label = $derived(describeState(sync));

	function onclick() {
		if (sync.kind === 'signin') void driveSync.resume();
		else open = true;
	}
</script>

{#if driveSync.available && driveSync.connected}
	<button
		type="button"
		class="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none data-[attention]:text-danger pointer-coarse:size-11"
		data-attention={sync.kind === 'signin' || sync.kind === 'error' || undefined}
		aria-label="Google Drive sync: {label}"
		title={label}
		data-testid="sync-indicator"
		data-state={sync.kind}
		{onclick}
	>
		{#if sync.kind === 'syncing'}
			<RefreshCw class="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
		{:else if sync.kind === 'offline'}
			<CloudOff class="size-4" aria-hidden="true" />
		{:else if sync.kind === 'signin' || sync.kind === 'error'}
			<CloudAlert class="size-4" aria-hidden="true" />
		{:else}
			<Cloud class="size-4" aria-hidden="true" />
		{/if}
	</button>
	<SyncDialog bind:open />
{/if}
