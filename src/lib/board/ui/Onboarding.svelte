<script lang="ts">
	import { formatKeys } from '../tools/formatKeys';
	import { help } from './helpState.svelte';

	// First-run tips, each anchored to a toolbar control.
	const TIPS: { anchor: string; text: string }[] = [
		{
			anchor: '[role="toolbar"][aria-label="Tools"]',
			text: 'Pick a tool, or press R, S, T. Double-click the canvas to write.'
		},
		{
			anchor: '[data-tool="connector"]',
			text: 'Hover any object and drag from its dots to connect it to anything.'
		},
		{
			anchor: '[data-tool="doccard"]',
			text: `Press N for a doc card; press ${formatKeys('Mod+Enter')} to open it full screen.`
		}
	];

	$effect(() => help.startIfFirstRun());

	const tip = $derived(help.tip === null ? null : (TIPS[help.tip] ?? null));
	let pos = $state<{ x: number; y: number } | null>(null);

	// Follow the anchor (the toolbar moves to the bottom on small screens).
	$effect(() => {
		if (!tip) {
			pos = null;
			return;
		}
		const place = () => {
			const r = document.querySelector(tip.anchor)?.getBoundingClientRect();
			if (!r) return;
			const below = r.left > window.innerWidth / 3; // horizontal toolbar: show above it
			pos = below
				? { x: Math.max(8, Math.min(r.left, window.innerWidth - 296)), y: r.top - 132 }
				: { x: r.right + 12, y: Math.max(8, r.top + r.height / 2 - 60) };
		};
		place();
		window.addEventListener('resize', place);
		return () => window.removeEventListener('resize', place);
	});

	function next() {
		if (help.tip === null) return;
		if (help.tip >= TIPS.length - 1) help.finishTips();
		else help.tip++;
	}

	const button =
		'h-8 rounded-lg px-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none';
</script>

{#if tip && pos && help.tip !== null}
	<div
		role="dialog"
		aria-label="Tip {help.tip + 1} of {TIPS.length}"
		data-interactive
		data-testid="onboarding-tip"
		class="fixed z-40 w-72 rounded-xl border border-border bg-surface p-4 shadow-xl"
		style:left="{pos.x}px"
		style:top="{pos.y}px"
	>
		<p class="text-xs font-medium text-muted">Tip {help.tip + 1} of {TIPS.length}</p>
		<p class="mt-1 text-sm">{tip.text}</p>
		<div class="mt-3 flex justify-end gap-2">
			<button
				type="button"
				class="{button} text-muted hover:bg-surface-2 hover:text-text"
				onclick={() => help.finishTips()}>Skip</button
			>
			<button type="button" class="{button} bg-accent text-accent-contrast" onclick={next}>
				{help.tip >= TIPS.length - 1 ? 'Got it' : 'Next'}
			</button>
		</div>
	</div>
{/if}
