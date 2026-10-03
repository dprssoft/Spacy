<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { getBoard } from '../context';
	import { worldToScreen } from '../engine/viewport';
	import { layout } from '$lib/shared/layout.svelte';
	import MediaControls from './MediaControls.svelte';

	// Controls bars of playing media, in screen space (the same size at any zoom). A bar shows
	// while its element is selected, hovered or being interacted with, and lingers 2 s after.
	const ctx = getBoard();
	const { store, viewport, selection, playback } = ctx;
	const LINGER_MS = 2000;
	const GAP = 8;
	const BAR_H = layout.coarse ? 54 : 42;
	const COMPACT_BELOW = 280;

	const active = (id: string) =>
		selection.has(id) || selection.hoverId === id || selection.editingId === id;

	// Ids whose bar is still showing after they stopped being active.
	const lingering = new SvelteMap<string, ReturnType<typeof setTimeout>>();
	// Bookkeeping only (not rendered).
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const wasActive = new Set<string>();
	$effect(() => {
		const states = [...playback.playing].map((id) => [id, active(id)] as const);
		untrack(() => update(states));
	});
	function update(states: (readonly [string, boolean])[]) {
		for (const [id, on] of states) {
			if (on) {
				wasActive.add(id);
				const t = lingering.get(id);
				if (t) clearTimeout(t);
				lingering.delete(id);
			} else if (wasActive.has(id) && !lingering.has(id)) {
				wasActive.delete(id);
				lingering.set(
					id,
					setTimeout(() => lingering.delete(id), LINGER_MS)
				);
			}
		}
	}
	$effect(() => () => {
		for (const t of lingering.values()) clearTimeout(t);
	});

	const bars = $derived(
		[...playback.playing].flatMap((id) => {
			const el = store.get(id);
			if (el?.type !== 'media' || !(active(id) || lingering.has(id))) return [];
			const tl = worldToScreen(viewport.vp, { x: el.x, y: el.y });
			const br = worldToScreen(viewport.vp, { x: el.x + el.w, y: el.y + el.h });
			const width = br.x - tl.x;
			// Under the element, or over its bottom edge when there's no room below.
			const below = br.y + GAP + BAR_H <= viewport.size.h;
			const top = below ? br.y + GAP : br.y - BAR_H - GAP;
			return [{ el, left: tl.x, width, top, compact: layout.compact || width < COMPACT_BELOW }];
		})
	);
</script>

{#each bars as b (b.el.id)}
	{@const controller = playback.controllers.get(b.el.id)}
	<div
		class="absolute flex justify-center"
		style:left="{b.left}px"
		style:top="{b.top}px"
		style:width="{Math.max(b.width, b.compact ? 0 : 320)}px"
		data-media-bar={b.el.id}
	>
		{#if playback.fallback.has(b.el.id)}
			<p
				class="pointer-events-auto rounded-lg border border-border bg-surface px-2 py-1 text-xs text-muted shadow"
			>
				Using the player’s controls
			</p>
		{:else if controller}
			<div class="w-full" class:w-auto={b.compact}>
				<MediaControls el={b.el} {controller} compact={b.compact} />
			</div>
		{/if}
	</div>
{/each}
