<script lang="ts">
	import { Popover } from 'bits-ui';
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import Radio from '@lucide/svelte/icons/radio';
	import Users from '@lucide/svelte/icons/users';
	import { toast } from 'svelte-sonner';
	import type { LiveShare } from './liveState.svelte';

	let { live }: { live: LiveShare } = $props();

	let copied = $state(false);

	async function copy() {
		const link = live.link;
		if (!link) return;
		try {
			await navigator.clipboard.writeText(link);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			toast.error('Couldn’t copy the link');
		}
	}

	const status = $derived(
		live.problem && live.state.kind !== 'live'
			? 'Couldn’t connect to someone: a network on either side may block direct connections.'
			: live.state.kind === 'live'
				? `${live.state.peers} other ${live.state.peers === 1 ? 'person' : 'people'} here`
				: 'Waiting for others to open the link'
	);
	const button =
		'inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none pointer-coarse:h-11';
</script>

<Popover.Root onOpenChange={(o) => o && void live.checkClock()}>
	<Popover.Trigger
		class="inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none max-sm:px-2 pointer-coarse:h-11 pointer-coarse:min-w-11"
		data-testid="share"
	>
		{#if live.share}
			<Radio class="size-4 text-accent" aria-hidden="true" />
			<span class="max-sm:sr-only">Live</span>
			{#if live.state.kind === 'live'}
				<span class="text-xs text-muted" data-testid="live-peers">{live.state.peers + 1}</span>
			{/if}
		{:else}
			<Users class="size-4" aria-hidden="true" />
			<span class="max-sm:sr-only">Share</span>
		{/if}
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content
			align="end"
			sideOffset={4}
			class="z-50 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface p-3 shadow-lg"
		>
			{#if live.share}
				<p class="text-sm font-medium">Anyone with the link can edit this board</p>
				<p class="mt-1 text-xs text-muted" data-testid="live-status">{status}</p>
				{#if live.clockOff}
					<p
						class="mt-2 rounded-md bg-surface-2 p-2 text-xs text-danger"
						data-testid="clock-warning"
					>
						Your computer’s clock is {live.clockOff}, so live sharing can’t connect. Turn on “Set
						time automatically” in your system’s date and time settings, then reload.
					</p>
				{/if}
				<div class="mt-3 flex gap-2">
					<input
						readonly
						value={live.link}
						aria-label="Share link"
						class="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-2 text-xs"
						onfocus={(e) => e.currentTarget.select()}
					/>
					<button
						type="button"
						class="{button} gap-1.5 bg-accent text-accent-contrast"
						onclick={copy}
					>
						{#if copied}<Check class="size-4" aria-hidden="true" />Copied{:else}<Copy
								class="size-4"
								aria-hidden="true"
							/>Copy link{/if}
					</button>
				</div>
				<p class="mt-3 text-xs text-muted">
					Edits go directly between browsers while the board is open. Each person keeps their own
					copy.
				</p>
				<button
					type="button"
					class="{button} mt-2 -ml-3 text-danger hover:bg-surface-2"
					onclick={() => live.stop()}
				>
					Stop sharing
				</button>
			{:else}
				<p class="text-sm font-medium">Edit this board together</p>
				<p class="mt-1 text-xs text-muted">
					Get a link for others to edit with you in real time. Nothing is stored on a server.
				</p>
				<button
					type="button"
					class="{button} mt-3 w-full bg-accent text-accent-contrast"
					onclick={() => live.start()}
				>
					Share live
				</button>
			{/if}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
