<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import X from '@lucide/svelte/icons/x';
	import { toast } from 'svelte-sonner';
	import { getActivePageId } from '$lib/model/doc';
	import { getBoard } from '../context';
	import { jumpToElement } from '../doccards/jumpTo';
	import { allPageIds, replaceHits, searchBoard, type Hit } from './findReplace';
	import { findState } from './findState.svelte';
	import { makeMatcher } from './search';

	const ctx = getBoard();
	let query = $state('');
	let replacement = $state('');
	let matchCase = $state(false);
	let wholeWord = $state(false);
	let regex = $state(false);
	let allPages = $state(false);
	let current = $state(0);
	let input = $state<HTMLInputElement>();

	$effect(() => {
		void findState.focusTick;
		input?.focus();
		input?.select();
	});

	const matcher = $derived(makeMatcher(query, { matchCase, wholeWord, regex }));
	const error = $derived(matcher && 'error' in matcher ? matcher.error : null);
	const hits = $derived.by((): Hit[] => {
		if (!matcher || 'error' in matcher) return [];
		void ctx.store.version; // canvas edits
		void ctx.words.version; // doc card edits (after a pause)
		void ctx.pages.current;
		return searchBoard(
			ctx.doc,
			matcher,
			allPages ? allPageIds(ctx.doc) : [getActivePageId(ctx.doc)]
		);
	});
	const objects = $derived(new Set(hits.map((h) => h.elementId)).size);
	const groups = $derived.by(() => {
		const out: { id: string; hits: { hit: Hit; index: number }[] }[] = [];
		hits.forEach((hit, index) => {
			const last = out.at(-1);
			if (last?.id === hit.elementId) last.hits.push({ hit, index });
			else out.push({ id: hit.elementId, hits: [{ hit, index }] });
		});
		return out;
	});
	$effect(() => {
		if (current >= hits.length) current = 0;
	});

	const label = (id: string) => {
		const el = ctx.store.get(id);
		if (!el) return 'Another page';
		if ('title' in el && el.title) return el.title;
		return el.type === 'doccard' ? 'Doc card' : el.type.charAt(0).toUpperCase() + el.type.slice(1);
	};

	function go(index: number) {
		if (hits.length === 0) return;
		current = (index + hits.length) % hits.length;
		jumpToElement(ctx, hits[current]!.elementId);
	}

	function replace(all: boolean) {
		if (!matcher || 'error' in matcher || hits.length === 0) return;
		const targets = all ? hits : [hits[current]!];
		ctx.undo.stopCapturing();
		const n = replaceHits(ctx.doc, targets, matcher, replacement);
		ctx.undo.stopCapturing();
		ctx.words.version++; // re-search now, not after the recount pause
		toast(`${n} ${n === 1 ? 'replacement' : 'replacements'}`);
	}

	function keys(e: KeyboardEvent) {
		e.stopPropagation();
		if (e.key === 'Escape') findState.open = false;
		else if (e.key === 'Enter') {
			e.preventDefault();
			go(current + (e.shiftKey ? -1 : 1));
		}
	}

	const toggle =
		'h-7 min-w-7 rounded-md px-1.5 text-xs font-medium text-muted hover:bg-surface-2 aria-pressed:bg-accent/15 aria-pressed:text-accent pointer-coarse:h-11 pointer-coarse:min-w-11';
	const icon =
		'inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text disabled:opacity-40 pointer-coarse:size-11';
	const field =
		'h-8 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 text-sm focus:border-accent focus:outline-none';
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	role="search"
	aria-label="Find and replace"
	data-interactive
	data-testid="find-panel"
	class="absolute top-2 right-2 z-30 flex max-h-[70%] w-96 max-w-[calc(100%-16px)] flex-col gap-2 rounded-xl border border-border bg-surface p-2 shadow-lg"
	onkeydown={keys}
>
	<div class="flex items-center gap-1">
		<input
			bind:this={input}
			bind:value={query}
			class={field}
			placeholder="Find"
			aria-label="Find"
		/>
		<button
			type="button"
			class={toggle}
			aria-pressed={matchCase}
			title="Match case"
			onclick={() => (matchCase = !matchCase)}>Aa</button
		>
		<button
			type="button"
			class={toggle}
			aria-pressed={wholeWord}
			title="Whole word"
			onclick={() => (wholeWord = !wholeWord)}>W</button
		>
		<button
			type="button"
			class={toggle}
			aria-pressed={regex}
			title="Regular expression"
			onclick={() => (regex = !regex)}>.*</button
		>
		<button
			type="button"
			class={icon}
			aria-label="Close find"
			onclick={() => (findState.open = false)}><X class="size-4" aria-hidden="true" /></button
		>
	</div>
	<div class="flex items-center gap-1">
		<input
			bind:value={replacement}
			class={field}
			placeholder="Replace with"
			aria-label="Replace with"
		/>
		<button
			type="button"
			class="{toggle} px-2"
			disabled={hits.length === 0}
			onclick={() => replace(false)}>Replace</button
		>
		<button
			type="button"
			class="{toggle} px-2"
			disabled={hits.length === 0}
			onclick={() => replace(true)}>All</button
		>
	</div>
	<div class="flex items-center gap-2 text-xs text-muted">
		<span data-testid="find-status" class:text-danger={error}>
			{error ??
				(query
					? hits.length
						? `${current + 1} of ${hits.length} matches in ${objects} ${objects === 1 ? 'object' : 'objects'}`
						: 'No matches'
					: '')}
		</span>
		<label class="ml-auto flex items-center gap-1"
			><input type="checkbox" bind:checked={allPages} />All pages</label
		>
		<button
			type="button"
			class={icon}
			aria-label="Previous match"
			disabled={!hits.length}
			onclick={() => go(current - 1)}><ChevronUp class="size-4" aria-hidden="true" /></button
		>
		<button
			type="button"
			class={icon}
			aria-label="Next match"
			disabled={!hits.length}
			onclick={() => go(current + 1)}><ChevronDown class="size-4" aria-hidden="true" /></button
		>
	</div>
	{#if groups.length}
		<ul class="min-h-0 overflow-y-auto text-sm" data-testid="find-results">
			{#each groups as g (g.id)}
				<li class="py-1">
					<p class="truncate px-1 text-xs font-semibold text-muted">{label(g.id)}</p>
					{#each g.hits as { hit, index } (hit.key)}
						<button
							type="button"
							class="block w-full truncate rounded-md px-1 py-0.5 text-left hover:bg-surface-2"
							class:bg-accent={index === current}
							class:text-accent-contrast={index === current}
							onclick={() => go(index)}
						>
							{hit.context.before}<mark class="rounded bg-yellow-200 px-0.5 text-black"
								>{hit.context.match}</mark
							>{hit.context.after}
						</button>
					{/each}
				</li>
			{/each}
		</ul>
	{/if}
</div>
