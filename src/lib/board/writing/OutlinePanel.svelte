<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import X from '@lucide/svelte/icons/x';
	import { SvelteSet } from 'svelte/reactivity';
	import { getBoard } from '../context';
	import { jumpToElement } from '../doccards/jumpTo';
	import { openFocus } from '../doccards/focus';
	import type { OutlineState } from './outlineState.svelte';
	import { compileDialog } from './compileDialogState.svelte';

	let { outline }: { outline: OutlineState } = $props();

	const ctx = getBoard();
	const chapters = $derived(outline.chapters);
	const words = (id: string) => ctx.words.cardWords(id);
	const total = $derived.by(() => {
		void ctx.words.version;
		return chapters.reduce((n, c) => n + c.cards.reduce((m, x) => m + words(x.id), 0), 0);
	});
	const collapsed = new SvelteSet<string>();
	const key = (frame: { id: string } | null) => frame?.id ?? '';
	const nf = new Intl.NumberFormat('en');

	// Drag and drop: rows (and chapter headers, for "at the start") are drop targets.
	let dragging = $state<string | null>(null);
	let dropAt = $state<{ frame: string | null; index: number } | null>(null);

	function overRow(e: DragEvent, frame: string | null, index: number) {
		if (!dragging) return;
		e.preventDefault();
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		dropAt = { frame, index: e.clientY > r.top + r.height / 2 ? index + 1 : index };
	}
	function drop(e: DragEvent) {
		e.preventDefault();
		if (dragging && dropAt) {
			const ch = chapters.find((c) => (c.frame?.id ?? null) === dropAt!.frame);
			const from = ch?.cards.findIndex((c) => c.id === dragging) ?? -1;
			// The index counts the chapter without the moved card.
			const index = from >= 0 && from < dropAt.index ? dropAt.index - 1 : dropAt.index;
			outline.move(dragging, dropAt.frame, index);
		}
		dragging = null;
		dropAt = null;
	}

	/** Alt+↑/↓: one place up or down, across chapter boundaries. */
	function rowKey(e: KeyboardEvent, id: string, ci: number, i: number) {
		if (e.key === 'Enter') {
			jumpToElement(ctx, id);
			return;
		}
		if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
		e.preventDefault();
		const ch = chapters[ci]!;
		const up = e.key === 'ArrowUp';
		if (up && i > 0) outline.move(id, key(ch.frame) || null, i - 1);
		else if (!up && i < ch.cards.length - 1) outline.move(id, key(ch.frame) || null, i + 1);
		else if (up && ci > 0)
			outline.move(id, key(chapters[ci - 1]!.frame) || null, chapters[ci - 1]!.cards.length);
		else if (!up && ci < chapters.length - 1)
			outline.move(id, key(chapters[ci + 1]!.frame) || null, 0);
		queueMicrotask(() =>
			document.querySelector<HTMLElement>(`[data-outline-card="${id}"]`)?.focus()
		);
	}
</script>

<aside
	aria-label="Outline"
	data-interactive
	data-testid="outline-panel"
	class="flex h-full min-h-0 w-72 shrink-0 flex-col border-l border-border bg-surface text-sm max-sm:w-full max-sm:border-l-0"
>
	<header class="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
		<h2 class="font-semibold">Outline</h2>
		<span class="text-xs text-muted tabular-nums" data-testid="outline-total"
			>{nf.format(total)} words</span
		>
		<button
			type="button"
			class="ml-auto h-7 rounded-md px-2 text-xs text-muted hover:bg-surface-2 hover:text-text pointer-coarse:h-11"
			onclick={() => (compileDialog.open = true)}>Compile…</button
		>
		<button
			type="button"
			class="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text pointer-coarse:size-11"
			aria-label="Close outline"
			onclick={() => outline.toggle()}
		>
			<X class="size-4" aria-hidden="true" />
		</button>
	</header>
	<div class="min-h-0 flex-1 overflow-y-auto p-2">
		{#each chapters as ch, ci (key(ch.frame))}
			{@const chWords = ch.cards.reduce((n, c) => n + words(c.id), 0)}
			<section aria-label={ch.frame?.title || 'Not in a chapter'} class="mb-2">
				<button
					type="button"
					class="flex w-full items-center gap-1 rounded-md px-1 py-1 text-left text-xs font-semibold tracking-wide text-muted uppercase hover:bg-surface-2"
					aria-expanded={!collapsed.has(key(ch.frame))}
					ondragover={(e) => overRow(e, ch.frame?.id ?? null, -0.5)}
					ondrop={drop}
					onclick={() =>
						collapsed.has(key(ch.frame))
							? collapsed.delete(key(ch.frame))
							: collapsed.add(key(ch.frame))}
					data-outline-chapter={key(ch.frame)}
				>
					<ChevronDown
						class="size-3.5 transition {collapsed.has(key(ch.frame)) ? '-rotate-90' : ''}"
						aria-hidden="true"
					/>
					<span class="truncate">{ch.frame?.title || 'Not in a chapter'}</span>
					<span class="ml-auto font-normal normal-case tabular-nums">{nf.format(chWords)}</span>
				</button>
				{#if !collapsed.has(key(ch.frame))}
					{#each ch.cards as card, i (card.id)}
						<div
							role="button"
							aria-roledescription="scene"
							tabindex="0"
							draggable="true"
							data-outline-card={card.id}
							aria-label="{card.title}, {words(card.id)} words"
							aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
							class="group relative flex cursor-pointer items-start gap-1 rounded-md px-1 py-1.5 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none pointer-coarse:py-3"
							class:opacity-40={dragging === card.id}
							ondragstart={(e) => {
								dragging = card.id;
								e.dataTransfer?.setData('text/plain', card.title);
							}}
							ondragend={() => {
								dragging = null;
								dropAt = null;
							}}
							ondragover={(e) => overRow(e, ch.frame?.id ?? null, i)}
							ondrop={drop}
							onclick={() => jumpToElement(ctx, card.id)}
							ondblclick={() => openFocus(ctx.id, card.id)}
							onkeydown={(e) => rowKey(e, card.id, ci, i)}
						>
							{#if dropAt && (dropAt.frame ?? null) === (ch.frame?.id ?? null) && (dropAt.index === i || (dropAt.index < 0 && i === 0))}
								<span class="absolute inset-x-1 -top-px h-0.5 rounded bg-accent"></span>
							{/if}
							<GripVertical
								class="mt-0.5 size-3.5 shrink-0 text-muted opacity-0 group-hover:opacity-100"
								aria-hidden="true"
							/>
							<div class="min-w-0 flex-1">
								<p class="truncate font-medium">{card.title || 'Untitled'}</p>
								<p class="truncate text-xs text-muted">
									{ctx.words.cardFirstLine(card.id, card.title) || ' '}
								</p>
							</div>
							<span class="shrink-0 text-xs text-muted tabular-nums"
								>{nf.format(words(card.id))}</span
							>
						</div>
					{/each}
				{/if}
			</section>
		{:else}
			<p class="p-4 text-center text-xs text-muted">
				Doc cards on this page appear here, chapter by chapter (frames).
			</p>
		{/each}
	</div>
</aside>
