<script lang="ts">
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import Locate from '@lucide/svelte/icons/locate';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Presentation from '@lucide/svelte/icons/presentation';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { getBoard } from '../context';

	const ctx = getBoard();
	const { waystones } = ctx;
	const route = $derived(waystones.route);

	let renaming = $state<string | null>(null);
	let dragging = $state<string | null>(null);
	let dropAt = $state<number | null>(null);

	function rowKey(e: KeyboardEvent, id: string, i: number) {
		if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
		e.preventDefault();
		waystones.move(id, e.key === 'ArrowUp' ? i - 1 : i + 1);
		queueMicrotask(() =>
			document.querySelector<HTMLElement>(`[data-waystone-row="${id}"] [data-go]`)?.focus()
		);
	}
	function over(e: DragEvent, i: number) {
		if (!dragging) return;
		e.preventDefault();
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		dropAt = e.clientY > r.top + r.height / 2 ? i + 1 : i;
	}
	function drop(e: DragEvent) {
		e.preventDefault();
		if (dragging && dropAt !== null) {
			const from = route.findIndex((w) => w.id === dragging);
			// The index counts the route without the moved waystone.
			waystones.move(dragging, from < dropAt ? dropAt - 1 : dropAt);
		}
		dragging = null;
		dropAt = null;
	}
	const icon =
		'inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text pointer-coarse:size-11';
</script>

<div class="flex items-center gap-2 px-1 pb-1">
	<p class="text-xs font-semibold text-muted">Tabs</p>
	<label class="ml-auto flex items-center gap-1.5 text-xs text-muted">
		<input
			type="checkbox"
			checked={waystones.wrap}
			onchange={(e) => waystones.setWrap(e.currentTarget.checked)}
		/>Wrap around
	</label>
</div>
{#if route.length === 0}
	<p class="px-1 py-2 text-sm text-muted">
		Save the spot you're looking at, then jump back to it from this list.
	</p>
{/if}
<ol class="flex max-h-72 flex-col overflow-y-auto" data-testid="waystone-list">
	{#each route as w, i (w.id)}
		<li
			class="group flex items-center gap-1 rounded-md hover:bg-surface-2"
			class:border-t-2={dropAt === i}
			class:border-b-2={dropAt === i + 1 && i === route.length - 1}
			class:border-accent={dropAt === i || dropAt === i + 1}
			data-waystone-row={w.id}
			draggable={renaming !== w.id}
			ondragstart={() => (dragging = w.id)}
			ondragend={() => {
				dragging = null;
				dropAt = null;
			}}
			ondragover={(e) => over(e, i)}
			ondrop={drop}
		>
			<GripVertical class="size-3.5 shrink-0 cursor-grab text-muted" aria-hidden="true" />
			<span
				class="flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
				style:background={w.style.fill}>{i + 1}</span
			>
			{#if renaming === w.id}
				<input
					class="h-7 min-w-0 flex-1 rounded border border-border bg-surface px-1.5 text-sm outline-none focus:border-accent pointer-coarse:text-base"
					value={w.name}
					aria-label="Tab name"
					maxlength="100"
					{@attach (node: HTMLInputElement) => {
						node.focus();
						node.select();
					}}
					onkeydown={(e) => {
						if (e.key === 'Enter') e.currentTarget.blur();
						if (e.key === 'Escape') {
							e.stopPropagation();
							renaming = null;
						}
					}}
					onblur={(e) => {
						if (renaming === w.id) waystones.rename(w.id, e.currentTarget.value);
						renaming = null;
					}}
				/>
			{:else}
				<button
					type="button"
					class="h-8 min-w-0 flex-1 truncate rounded px-1.5 text-left text-sm pointer-coarse:h-11"
					class:font-semibold={i === waystones.current}
					aria-keyshortcuts={i < 9 ? `Alt+${i + 1}` : undefined}
					data-go
					onclick={() => {
						waystones.go(i);
						waystones.listOpen = false;
					}}
					onkeydown={(e) => rowKey(e, w.id, i)}>{w.name || `Tab ${i + 1}`}</button
				>
			{/if}
			<button
				type="button"
				class={icon}
				aria-label="Rename {w.name}"
				title="Rename"
				onclick={() => (renaming = w.id)}><Pencil class="size-3.5" aria-hidden="true" /></button
			>
			<button
				type="button"
				class={icon}
				aria-label="Move {w.name} to the current view"
				title="Move to current view"
				onclick={() => waystones.updateView(w.id)}
				><Locate class="size-3.5" aria-hidden="true" /></button
			>
			<button
				type="button"
				class={icon}
				aria-label="Delete {w.name}"
				title="Delete"
				onclick={() => waystones.remove(w.id)}
				><Trash2 class="size-3.5" aria-hidden="true" /></button
			>
		</li>
	{/each}
</ol>
<div class="mt-1 flex gap-1">
	<button
		type="button"
		class="flex h-8 flex-1 items-center gap-1.5 rounded-md px-2 text-sm text-accent hover:bg-surface-2 pointer-coarse:h-11"
		onclick={() => (renaming = waystones.add())}
		><Plus class="size-4" aria-hidden="true" />Add tab here</button
	>
	<button
		type="button"
		disabled={route.length === 0}
		class="flex h-8 items-center gap-1.5 rounded-md px-2 text-sm hover:bg-surface-2 disabled:opacity-40 pointer-coarse:h-11"
		onclick={() => waystones.present()}
		><Presentation class="size-4" aria-hidden="true" />Present</button
	>
</div>
