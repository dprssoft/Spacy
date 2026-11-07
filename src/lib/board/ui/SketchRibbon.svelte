<script lang="ts">
	import Brush from '@lucide/svelte/icons/brush';
	import Eraser from '@lucide/svelte/icons/eraser';
	import FilePlus from '@lucide/svelte/icons/file-plus';
	import Highlighter from '@lucide/svelte/icons/highlighter';
	import PenLine from '@lucide/svelte/icons/pen-line';
	import Pencil from '@lucide/svelte/icons/pencil';
	import { getBoard } from '../context';
	import { ink } from '../elements/common';
	import { applyStyle } from '../style/applyStyle';
	import { BRUSHES, MAX_SIZE, MIN_SIZE, type BrushId } from '../sketch/brushes';
	import ColorSwatches from '../style/controls/ColorSwatches.svelte';
	import PanelButton from '../style/controls/PanelButton.svelte';
	import { OPAQUE_SWATCHES, PALETTE_SWATCHES } from '../style/palette';

	// The contextual part of the ribbon while the sketch tool is active.
	let { groupBox, caption, button }: { groupBox: string; caption: string; button: string } =
		$props();

	const ctx = getBoard();
	const { sketch } = ctx;
	const ICONS: Record<BrushId, typeof Brush> = {
		pen: PenLine,
		pencil: Pencil,
		marker: Brush,
		highlighter: Highlighter,
		eraser: Eraser
	};
	// One tap away: black and the main shade of each hue; everything else under "More colors".
	const QUICK = [
		'Black',
		'Gray',
		'Red',
		'Orange',
		'Yellow',
		'Green',
		'Teal',
		'Blue',
		'Violet',
		'Pink'
	];
	const colors = OPAQUE_SWATCHES.filter((c) => QUICK.includes(c.name));
	const quick = $derived(colors.some((c) => c.value === sketch.color));

	// The style bar is hidden while drawing, so the sheet of the active sketch is set from here.
	const active = $derived.by(() => {
		void ctx.store.version;
		const el = sketch.activeId ? ctx.store.get(sketch.activeId) : undefined;
		return el?.type === 'sketch' && !el.locked ? el : null;
	});
	const sheet = $derived(active?.style.fillStyle === 'none' ? 'transparent' : active?.style.fill);

	function newSketch() {
		sketch.activeId = null;
		ctx.selection.clear();
	}
</script>

<div role="group" aria-label="Brush" class={groupBox}>
	<div class="flex items-center gap-0.5" role="radiogroup" aria-label="Brush">
		{#each BRUSHES as b (b.id)}
			{@const Icon = ICONS[b.id]}
			<button
				type="button"
				role="radio"
				class="{button} aria-checked:bg-accent/15 aria-checked:text-accent"
				aria-label={b.label}
				aria-checked={sketch.brush === b.id}
				title="{b.label} — {b.hint}"
				data-brush={b.id}
				onclick={() => sketch.set({ brush: b.id })}
			>
				<Icon class="size-[18px]" aria-hidden="true" />
			</button>
		{/each}
	</div>
	<span class={caption} aria-hidden="true">Brush</span>
</div>
<div role="group" aria-label="Brush size" class={groupBox}>
	<label class="flex h-8 items-center gap-2 text-xs text-muted">
		<input
			type="range"
			min={MIN_SIZE}
			max={MAX_SIZE}
			step="1"
			value={sketch.size}
			aria-label="Brush size"
			class="w-28 accent-(--accent)"
			oninput={(e) => sketch.set({ size: Number(e.currentTarget.value) })}
		/>
		<span class="w-5 text-right tabular-nums">{sketch.size}</span>
	</label>
	<span class={caption} aria-hidden="true">Size</span>
</div>
<div role="group" aria-label="Brush color" class={groupBox}>
	<div class="flex h-8 items-center gap-1" role="radiogroup" aria-label="Brush color">
		{#each colors as c (c.value)}
			<button
				type="button"
				role="radio"
				aria-label={c.name}
				aria-checked={sketch.color === c.value}
				title={c.name}
				class="size-5 rounded-full border border-border focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-none aria-checked:ring-2 aria-checked:ring-accent aria-checked:ring-offset-1 aria-checked:ring-offset-surface"
				style:background={ink(c.value)}
				onclick={() => sketch.set({ color: c.value })}
			></button>
		{/each}
		<PanelButton label="More colors" testId="sketch-more-colors">
			{#snippet trigger()}
				<span
					class="size-5 rounded-full border border-border"
					class:ring-2={!quick}
					class:ring-accent={!quick}
					style:background={quick
						? 'conic-gradient(#e03131, #f59f00, #2f9e44, #1971c2, #6741d9, #e03131)'
						: ink(sketch.color)}
				></span>
			{/snippet}
			<ColorSwatches
				value={sketch.color}
				colors={OPAQUE_SWATCHES}
				label="Brush color"
				followTheme
				onchange={(c) => sketch.set({ color: c })}
			/>
		</PanelButton>
	</div>
	<span class={caption} aria-hidden="true">Color</span>
</div>
<div role="group" aria-label="Sketch" class={groupBox}>
	<div class="flex items-center gap-1">
		{#if active}
			<PanelButton label="Sheet color" testId="sketch-sheet">
				{#snippet trigger()}
					<span class="size-5 rounded border border-border" style:background={sheet}></span>
				{/snippet}
				<ColorSwatches
					value={sheet ?? 'transparent'}
					colors={PALETTE_SWATCHES}
					label="Sheet color"
					onchange={(c) => applyStyle(ctx, [active.id], { style: { fill: c } })}
				/>
			</PanelButton>
		{/if}
		<button
			type="button"
			class="{button} w-auto gap-1.5 px-2 text-xs"
			title="The next stroke starts a new sketch object"
			disabled={!sketch.activeId}
			onclick={newSketch}
		>
			<FilePlus class="size-[18px]" aria-hidden="true" />New sketch
		</button>
	</div>
	<span class={caption} aria-hidden="true"
		>{sketch.activeId ? 'Drawing into one object' : 'Sketch'}</span
	>
</div>
