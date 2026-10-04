<script lang="ts">
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import { getBoard } from '../context';
	import { definitionOf } from '../elements';
	import { worldToScreen } from '../engine/viewport';

	// Unresolved comment counts at objects' top-right corners, in screen space (the same size at
	// any zoom).
	const ctx = getBoard();
	const { store, viewport, comments } = ctx;

	const badges = $derived.by(() => {
		void store.version;
		const { w, h } = viewport.size;
		return [...comments.openByElement].flatMap(([id, count]) => {
			const el = store.get(id);
			if (!el) return [];
			const r = definitionOf(el).aabb(el, store.world);
			const p = worldToScreen(viewport.vp, { x: r.x + r.w, y: r.y });
			if (p.x < -40 || p.y < -40 || p.x > w + 40 || p.y > h + 40) return [];
			return [{ id, count, x: p.x, y: p.y }];
		});
	});
</script>

{#each badges as b (b.id)}
	<button
		type="button"
		class="pointer-events-auto absolute flex h-6 min-w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-0.5 rounded-full rounded-bl-sm bg-accent px-1.5 text-xs font-semibold text-accent-contrast shadow-md hover:brightness-110 pointer-coarse:h-9 pointer-coarse:min-w-9"
		style:left="{b.x}px"
		style:top="{b.y}px"
		aria-label="{b.count} {b.count === 1 ? 'comment' : 'comments'}"
		title="{b.count} open {b.count === 1 ? 'comment' : 'comments'}"
		data-interactive
		data-comment-badge={b.id}
		onclick={() => comments.openElement(b.id)}
	>
		<MessageSquare class="size-3" aria-hidden="true" />{b.count}
	</button>
{/each}
