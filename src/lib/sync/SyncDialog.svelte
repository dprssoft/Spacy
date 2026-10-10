<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { resolve } from '$app/paths';
	import { relativeTime } from '$lib/shared/relativeTime';
	import { driveSync } from './driveSync.svelte';
	import { describeState } from './describe';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let confirming = $state(false);
	let alsoDelete = $state(false);

	$effect(() => {
		if (open) void driveSync.prepare().catch(() => {});
		else confirming = false;
	});

	const sync = $derived(driveSync.state);
	const button =
		'inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-medium focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-50';

	async function disconnect() {
		await driveSync.disconnect(alsoDelete);
		confirming = false;
		alsoDelete = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-6 shadow-xl"
		>
			<Dialog.Title class="text-base font-semibold">Google Drive sync</Dialog.Title>
			{#if !driveSync.connected}
				<Dialog.Description class="mt-2 text-sm text-muted">
					Keep your boards, the board list and images in sync between your devices. Spacy stores
					them in a hidden folder of your own Google Drive that only Spacy can see.
				</Dialog.Description>
				<p class="mt-2 text-xs text-muted">
					<a href={resolve('/privacy')} class="underline underline-offset-2">Privacy</a>
				</p>
				<div class="mt-5 flex justify-end gap-2">
					<Dialog.Close class="{button} bg-surface-2 hover:bg-border">Cancel</Dialog.Close>
					<button
						type="button"
						class="{button} bg-accent text-accent-contrast hover:opacity-90"
						disabled={driveSync.busy}
						onclick={() => driveSync.connect()}
					>
						Connect Google Drive
					</button>
				</div>
			{:else if confirming}
				<Dialog.Description class="mt-2 text-sm">
					Stop syncing this browser? Your boards stay here.
				</Dialog.Description>
				<label class="mt-3 flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={alsoDelete} class="size-4 accent-[var(--accent)]" />
					Also delete Spacy’s copy in Google Drive
				</label>
				<p class="mt-1 text-xs text-muted">Your other devices then stop getting changes too.</p>
				<div class="mt-5 flex justify-end gap-2">
					<button
						type="button"
						class="{button} bg-surface-2 hover:bg-border"
						onclick={() => (confirming = false)}>Cancel</button
					>
					<button
						type="button"
						class="{button} bg-danger text-white hover:opacity-90"
						disabled={driveSync.busy}
						onclick={disconnect}>Disconnect</button
					>
				</div>
			{:else}
				<Dialog.Description class="mt-2 text-sm">
					Syncing with {driveSync.email ?? 'your Google Drive'}.
				</Dialog.Description>
				<p class="mt-1 text-sm text-muted" data-testid="sync-state">
					{describeState(sync)}{#if sync.kind === 'synced'}
						· {relativeTime(sync.at)}{/if}
				</p>
				<div class="mt-5 flex flex-wrap justify-end gap-2">
					<button
						type="button"
						class="{button} mr-auto px-2 text-danger hover:bg-surface-2"
						onclick={() => (confirming = true)}>Disconnect…</button
					>
					{#if sync.kind === 'signin'}
						<button
							type="button"
							class="{button} bg-accent text-accent-contrast"
							onclick={() => driveSync.resume()}>Sign in again</button
						>
					{:else}
						<button
							type="button"
							class="{button} bg-surface-2 hover:bg-border"
							disabled={sync.kind === 'syncing'}
							onclick={() => driveSync.syncNow()}>Sync now</button
						>
					{/if}
					<Dialog.Close class="{button} bg-surface-2 hover:bg-border">Close</Dialog.Close>
				</div>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
