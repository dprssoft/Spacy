<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import { createThread } from '$lib/model/comments';
	import { layout } from '$lib/shared/layout.svelte';
	import { getBoard } from '../context';
	import { activeDocEditor } from '../doccards/activeEditor.svelte';
	import { definitionOf } from '../elements';
	import { worldToScreen } from '../engine/viewport';
	import { targetOf } from './commentsState.svelte';
	import CommentComposer from './CommentComposer.svelte';
	import CommentThreadView from './CommentThreadView.svelte';

	// The comment popover: next to its object or text on larger screens, a bottom sheet on phones.
	const ctx = getBoard();
	const { comments, store, viewport } = ctx;
	const WIDTH = 320;

	const popover = $derived(comments.popover);
	const thread = $derived(
		popover?.kind === 'thread' ? comments.thread(popover.threadId) : undefined
	);
	const elementId = $derived(
		popover?.kind === 'element'
			? popover.elementId
			: popover?.kind === 'draft'
				? popover.draft.cardId
				: thread
					? targetOf(thread)
					: null
	);
	const elementThreads = $derived(
		popover?.kind === 'element'
			? comments.threads.filter((t) => !t.resolved && targetOf(t) === popover.elementId)
			: []
	);
	const resolvedCount = $derived(
		popover?.kind === 'element'
			? comments.threads.filter((t) => t.resolved && targetOf(t) === popover.elementId).length
			: 0
	);

	// Close when what it points at is gone (deleted here, in another tab, or undone).
	$effect(() => {
		if (!popover) return;
		void store.version;
		const gone =
			(popover.kind === 'thread' && !thread) || (elementId !== null && !store.get(elementId));
		if (gone) comments.close();
	});

	/** Where it points, in client coordinates. */
	const anchor = $derived.by(() => {
		if (!popover || !elementId || layout.compact) return null;
		void viewport.vp;
		if (popover.kind === 'draft') {
			const ed = popover.draft.editor;
			if (!ed.isDestroyed) {
				const c = ed.view.coordsAtPos(Math.min(popover.draft.to, ed.state.doc.content.size));
				return { x: c.left, y: c.bottom + 6 };
			}
		}
		if (thread?.anchor.kind === 'text') {
			const sel = `[data-comment="${CSS.escape(thread.id)}"]`;
			const mark =
				document.querySelector(`[data-focus-body] ${sel}`) ?? document.querySelector(sel);
			if (mark) {
				const r = mark.getBoundingClientRect();
				return { x: r.left, y: r.bottom + 6 };
			}
		}
		const el = store.get(elementId);
		const canvas = document.querySelector('[data-testid="canvas"]')?.getBoundingClientRect();
		if (!el || !canvas) return null;
		const r = definitionOf(el).aabb(el, store.world);
		const p = worldToScreen(viewport.vp, { x: r.x + r.w, y: r.y });
		return { x: canvas.left + p.x + 16, y: canvas.top + p.y };
	});
	const position = $derived(
		anchor && {
			left: Math.max(8, Math.min(anchor.x, window.innerWidth - WIDTH - 8)),
			top: Math.max(8, Math.min(anchor.y, window.innerHeight - 380))
		}
	);

	let root = $state<HTMLElement>();
	// A click elsewhere closes it (the click that opened it lands before it exists).
	$effect(() => {
		if (!popover) return;
		const onDown = (e: PointerEvent) => {
			if (!(e.target instanceof Node) || root?.contains(e.target)) return;
			if (e.target instanceof Element && e.target.closest('[data-comment-badge]')) return;
			comments.close();
		};
		window.addEventListener('pointerdown', onDown, true);
		return () => window.removeEventListener('pointerdown', onDown, true);
	});

	/**
	 * Escape closes it, also when focus fell to the page (the button pressed was replaced), and
	 * returns to the text being edited.
	 */
	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape' || !popover) return;
		const t = e.target instanceof Element ? e.target : null;
		const inside = !!t && !!root?.contains(t);
		if ((!inside && t && t !== document.body) || t?.closest('[data-own-escape]')) return;
		e.preventDefault();
		e.stopPropagation();
		const cardId = popover.kind === 'draft' ? popover.draft.cardId : elementId;
		const ed =
			popover.kind === 'draft'
				? popover.draft.editor
				: cardId && ctx.selection.editingId === cardId
					? activeDocEditor.current
					: null;
		comments.close();
		if (ed && !ed.isDestroyed) ed.commands.focus();
	}

	function addOnElement(id: string, author: string, text: string) {
		ctx.undo.stopCapturing();
		const threadId = createThread(ctx.doc, {
			anchor: { kind: 'element', elementId: id },
			page: ctx.pages.current,
			author,
			text
		});
		ctx.undo.stopCapturing();
		comments.openThread(threadId);
	}
</script>

<svelte:window onkeydowncapture={onWindowKeydown} />

{#if popover && (position || layout.compact)}
	<div
		bind:this={root}
		role="dialog"
		aria-label="Comments"
		tabindex="-1"
		data-interactive
		data-comment-popover
		class={layout.compact
			? 'fixed inset-x-0 bottom-0 z-[60] flex max-h-[60dvh] flex-col rounded-t-2xl border-t border-border bg-surface shadow-xl'
			: 'fixed z-[60] flex max-h-[min(480px,80dvh)] flex-col rounded-xl border border-border bg-surface shadow-xl'}
		style:left={position ? `${position.left}px` : undefined}
		style:top={position ? `${position.top}px` : undefined}
		style:width={layout.compact ? undefined : `${WIDTH}px`}
	>
		{#if layout.compact}
			<div class="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border" aria-hidden="true"></div>
		{/if}
		<header class="flex h-9 shrink-0 items-center gap-2 px-3">
			<h2 class="text-sm font-semibold">
				{popover.kind === 'draft' ? 'Comment on text' : 'Comments'}
			</h2>
			<button
				type="button"
				class="ml-auto inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text pointer-coarse:size-11"
				aria-label="Close comments"
				title="Close (Esc)"
				onclick={() => comments.close()}><X class="size-4" aria-hidden="true" /></button
			>
		</header>
		<div class="flex min-h-0 flex-col gap-4 overflow-y-auto px-3 pb-3">
			{#if popover.kind === 'thread' && thread}
				<CommentThreadView {thread} autofocus />
			{:else if popover.kind === 'draft'}
				<blockquote class="truncate border-l-2 border-accent pl-2 text-xs text-muted italic">
					{popover.draft.quote}
				</blockquote>
				<CommentComposer
					label="Add a comment"
					submitLabel="Comment"
					autofocus
					onsubmit={(author, text) => comments.postDraft(popover.draft, author, text)}
					oncancel={() => comments.close()}
				/>
			{:else if popover.kind === 'element'}
				{#each elementThreads as t (t.id)}
					<CommentThreadView thread={t} />
					<hr class="border-border" />
				{/each}
				{#if resolvedCount > 0}
					<button
						type="button"
						class="self-start text-xs text-accent hover:underline"
						onclick={() => {
							comments.filter = 'resolved';
							if (!comments.panelOpen) comments.togglePanel();
						}}>{resolvedCount} resolved</button
					>
				{/if}
				<CommentComposer
					label={elementThreads.length ? 'New thread' : 'Add a comment'}
					submitLabel="Comment"
					autofocus
					onsubmit={(author, text) => addOnElement(popover.elementId, author, text)}
				/>
			{/if}
		</div>
	</div>
{/if}
