<script lang="ts">
	import type { Peer } from './presenceData';

	let { peers }: { peers: Peer[] } = $props();

	const MAX = 4;
	const shown = $derived(peers.slice(0, MAX));
	const more = $derived(peers.length - shown.length);
	const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?';
</script>

{#if peers.length > 0}
	<ul class="flex items-center -space-x-1.5 max-sm:hidden" aria-label="People on this board">
		{#each shown as peer (peer.clientId)}
			<li
				class="flex size-6 items-center justify-center rounded-full text-xs font-medium text-white ring-2 ring-surface-2"
				style:background-color={peer.color}
				title={peer.name}
				data-testid="peer-avatar"
			>
				<span aria-hidden="true">{initial(peer.name)}</span>
				<span class="sr-only">{peer.name}</span>
			</li>
		{/each}
		{#if more > 0}
			<li
				class="flex size-6 items-center justify-center rounded-full bg-surface text-xs text-muted ring-2 ring-surface-2"
			>
				+{more}
			</li>
		{/if}
	</ul>
{/if}
