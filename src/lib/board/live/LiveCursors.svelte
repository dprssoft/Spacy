<script lang="ts">
	import { getBoard } from '../context';
	import { screenToWorld, worldToScreen } from '../engine/viewport';
	import { commentAuthor } from '../comments/author.svelte';
	import type { LiveShare } from './liveState.svelte';

	let { live }: { live: LiveShare } = $props();

	const ctx = getBoard();
	const presence = $derived(live.presence);

	$effect(() => {
		void commentAuthor.name;
		presence.refreshUser();
	});

	// Publishes this person's pointer (world units, current page) while it's over the board.
	$effect(() => {
		const canvas = document.querySelector<HTMLElement>('[data-testid="canvas"]');
		if (!canvas) return;
		const onMove = (e: PointerEvent) => {
			const r = canvas.getBoundingClientRect();
			const p = screenToWorld(ctx.viewport.vp, { x: e.clientX - r.left, y: e.clientY - r.top });
			presence.setCursor({ x: p.x, y: p.y, page: ctx.pages.current });
		};
		const onLeave = () => presence.setCursor(null);
		canvas.addEventListener('pointermove', onMove);
		canvas.addEventListener('pointerleave', onLeave);
		return () => {
			canvas.removeEventListener('pointermove', onMove);
			canvas.removeEventListener('pointerleave', onLeave);
			presence.setCursor(null);
		};
	});

	const cursors = $derived(
		presence.peers.flatMap((peer) => {
			const c = peer.cursor;
			if (!c || c.page !== ctx.pages.current) return [];
			return [{ peer, at: worldToScreen(ctx.viewport.vp, c) }];
		})
	);
</script>

{#each cursors as { peer, at } (peer.clientId)}
	<div
		class="pointer-events-none absolute top-0 left-0 z-20 transition-transform duration-75 ease-linear motion-reduce:transition-none"
		style:transform="translate({at.x}px, {at.y}px)"
		data-testid="live-cursor"
	>
		<svg width="16" height="20" viewBox="0 0 16 20" aria-hidden="true" class="drop-shadow">
			<path d="M1 1 L1 16 L5 12 L8 19 L11 18 L8 11 L14 11 Z" fill={peer.color} stroke="white" />
		</svg>
		<span
			class="absolute top-4 left-3 rounded px-1.5 py-0.5 text-xs whitespace-nowrap text-white"
			style:background-color={peer.color}>{peer.name}</span
		>
	</div>
{/each}
