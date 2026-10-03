<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { getBoard } from '../context';
	import { formatKeys } from '../tools/formatKeys';
	import type { Shortcut, ShortcutGroup } from '../tools/shortcuts';
	import { help } from './helpState.svelte';

	const ctx = getBoard();
	const GROUPS: ShortcutGroup[] = ['Tools', 'Edit', 'View', 'Arrange', 'Diagram', 'Doc'];
	// Gestures that aren't key bindings but belong in the list.
	const EXTRA: { group: ShortcutGroup; label: string; keys: string }[] = [
		{ group: 'Tools', label: 'Select the next / previous object', keys: 'Tab' },
		{ group: 'View', label: 'Pan', keys: 'Space+drag' },
		{
			group: 'Edit',
			label: 'Edit text of the selected object, or play media',
			keys: formatKeys('Enter')
		},
		{ group: 'Edit', label: 'Move the selection (Shift: 10 px)', keys: 'Arrows' }
	];

	let query = $state('');

	const groups = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const rows = [
			...ctx.shortcuts.all.map((s: Shortcut) => ({
				group: s.group,
				label: s.label,
				keys: s.keys.map((k) => formatKeys(k)).join('  /  ')
			})),
			...EXTRA
		].filter((r) => !q || r.label.toLowerCase().includes(q) || r.keys.toLowerCase().includes(q));
		return GROUPS.map((g) => ({ name: g, rows: rows.filter((r) => r.group === g) })).filter(
			(g) => g.rows.length > 0
		);
	});

	$effect(() => {
		if (!help.shortcutsOpen) query = '';
	});
</script>

<Dialog.Root bind:open={help.shortcutsOpen}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 flex max-h-[86dvh] w-[min(94vw,720px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-border bg-surface shadow-xl"
		>
			<div class="flex items-center gap-3 border-b border-border px-5 py-3">
				<Dialog.Title class="text-base font-semibold">Keyboard shortcuts</Dialog.Title>
				<input
					bind:value={query}
					type="text"
					role="searchbox"
					aria-label="Search shortcuts"
					placeholder="Search…"
					class="ml-auto h-8 w-48 rounded-md border border-border bg-bg px-2 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
				/>
				<Dialog.Close
					class="h-8 rounded-md px-2 text-sm text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
					>Close</Dialog.Close
				>
			</div>
			<Dialog.Description class="sr-only">
				All keyboard shortcuts, grouped by area. Type to filter.
			</Dialog.Description>
			<!-- Scrollable, so it must be reachable by keyboard. -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div
				class="grid gap-x-8 gap-y-5 overflow-y-auto px-5 py-4 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus-visible:ring-inset sm:grid-cols-2"
				role="region"
				aria-label="Shortcut list"
				tabindex="0"
			>
				{#each groups as g (g.name)}
					<section aria-label={g.name}>
						<h3 class="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
							{g.name}
						</h3>
						<dl class="space-y-1">
							{#each g.rows as r (r.label + r.keys)}
								<div class="flex items-baseline justify-between gap-4 text-sm">
									<dt class="min-w-0">{r.label}</dt>
									<dd class="shrink-0">
										<kbd class="rounded bg-surface-2 px-1.5 py-0.5 font-sans text-xs">{r.keys}</kbd>
									</dd>
								</div>
							{/each}
						</dl>
					</section>
				{:else}
					<p class="text-sm text-muted">No shortcuts match “{query}”.</p>
				{/each}
			</div>
			<p class="border-t border-border px-5 py-2.5 text-xs text-muted">
				To connect objects with the keyboard, select one and press {formatKeys(
					'Mod+Alt+ArrowRight'
				)}
				(or another arrow): it adds a connected copy in that direction.
			</p>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
