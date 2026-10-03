<script lang="ts">
	import type { LiveStats } from '../writing/editorStats';
	import { formatStats } from '../writing/wordCount';

	let { stats }: { stats: LiveStats | null } = $props();
	let details = $state(false);
	const nf = new Intl.NumberFormat('en');
</script>

{#if stats}
	<button
		type="button"
		class="rounded-md px-2 py-1 text-xs text-muted tabular-nums hover:bg-surface-2 hover:text-text"
		aria-expanded={details}
		data-testid="focus-count"
		onclick={() => (details = !details)}
	>
		{stats.selectionWords ? `${nf.format(stats.selectionWords)} of ` : ''}{formatStats(stats.words)}
	</button>
	{#if details}
		<dl
			class="absolute right-0 bottom-9 grid grid-cols-[auto_auto] gap-x-4 gap-y-1 rounded-lg border border-border bg-surface p-3 text-xs shadow-lg"
			data-testid="focus-count-details"
		>
			<dt class="text-muted">Words</dt>
			<dd class="text-right tabular-nums">{nf.format(stats.words)}</dd>
			<dt class="text-muted">Characters</dt>
			<dd class="text-right tabular-nums">{nf.format(stats.chars)}</dd>
			<dt class="text-muted">Without spaces</dt>
			<dd class="text-right tabular-nums">{nf.format(stats.charsNoSpaces)}</dd>
			<dt class="text-muted">Paragraphs</dt>
			<dd class="text-right tabular-nums">{nf.format(stats.paragraphs)}</dd>
			<dt class="text-muted">Reading time</dt>
			<dd class="text-right tabular-nums">{stats.readingMinutes} min</dd>
		</dl>
	{/if}
{/if}
