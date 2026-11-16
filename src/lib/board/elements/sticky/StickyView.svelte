<script lang="ts">
	import { STICKY_TEXT_COLOR } from '$lib/model/defaults';
	import { isColumn } from '$lib/model/kanban';
	import type { StickyElement } from '$lib/model/types';
	import { getBoard } from '../../context';
	import KanbanStatus from '../../kanban/KanbanStatus.svelte';
	import { fontToCss, radiusPx, valignToJustify } from '../common';
	import type { ElementViewProps } from '../registry';

	let { el, editing }: ElementViewProps<StickyElement> = $props();

	const ctx = getBoard();
	const column = $derived.by(() => {
		const parent = el.parentId ? ctx.store.get(el.parentId) : undefined;
		return isColumn(parent) ? parent : null;
	});
</script>

<div
	class="absolute inset-0 flex flex-col overflow-hidden p-4 break-words whitespace-pre-wrap"
	style="background:{el.color};border-radius:{radiusPx(
		el.style
	)}px;justify-content:{valignToJustify(el.style.font.valign)};{fontToCss({
		...el.style.font,
		color: STICKY_TEXT_COLOR
	})}"
	style:padding-bottom={column && !editing ? '40px' : undefined}
>
	{#if !editing}<div>{el.text}</div>{/if}
</div>
{#if column && !editing}
	<div class="absolute right-3 bottom-2 left-3 flex" style:color={STICKY_TEXT_COLOR}>
		<KanbanStatus cardId={el.id} {column} />
	</div>
{/if}
