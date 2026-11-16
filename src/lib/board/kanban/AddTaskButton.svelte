<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import { KANBAN, stacksIn, type KanbanColumn } from '$lib/model/kanban';
	import { getBoard } from '../context';
	import { addTask } from './ops';

	let { column }: { column: KanbanColumn } = $props();

	const ctx = getBoard();
	/** Just under the column's last card, in the column's own coordinates. */
	const top = $derived.by(() => {
		let bottom = KANBAN.pad - KANBAN.gap;
		for (const el of ctx.store.elements.values())
			if (stacksIn(el, column.id)) bottom = Math.max(bottom, el.y + el.h - column.y);
		return bottom + KANBAN.gap;
	});
</script>

<button
	type="button"
	class="pointer-events-auto absolute inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-current text-sm font-medium text-muted opacity-70 hover:bg-black/5 hover:opacity-100"
	style:left="{KANBAN.pad}px"
	style:top="{top}px"
	style:width="{Math.max(40, column.w - 2 * KANBAN.pad)}px"
	style:height="{KANBAN.addH}px"
	data-interactive
	data-testid="kanban-add-task"
	onpointerdown={(e) => e.stopPropagation()}
	onclick={() => addTask(ctx, column.id)}
>
	<Plus class="size-4" aria-hidden="true" />Add task
</button>
