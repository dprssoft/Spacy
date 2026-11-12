<script lang="ts">
	import AlignCenter from '@lucide/svelte/icons/align-center';
	import AlignLeft from '@lucide/svelte/icons/align-left';
	import AlignRight from '@lucide/svelte/icons/align-right';
	import Bold from '@lucide/svelte/icons/bold';
	import Download from '@lucide/svelte/icons/download';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import LayoutPanelLeft from '@lucide/svelte/icons/layout-panel-left';
	import Palette from '@lucide/svelte/icons/palette';
	import Italic from '@lucide/svelte/icons/italic';
	import type { Element, ShapeKind, Style } from '$lib/model/types';
	import { getBoard } from '../context';
	import { unionRects } from '../engine/geometry';
	import { worldToScreen } from '../engine/viewport';
	import { transformTargets } from '../selectionInfo';
	import { exportDialog } from '../ui/exportDialogState.svelte';
	import { applyStyle, type AppearancePatch } from './applyStyle';
	import ArrangePanel from './ArrangePanel.svelte';
	import ConnectorPanel from './ConnectorPanel.svelte';
	import Spline from '@lucide/svelte/icons/spline';
	import QuickStylesPanel from './QuickStylesPanel.svelte';
	import {
		hasCustomDefault,
		resetConnectorDefaults,
		resetDefaultStyle,
		setConnectorDefaults,
		setDefaultStyle
	} from './styleDefaults';
	import ColorSwatches from './controls/ColorSwatches.svelte';
	import FontMenu from './controls/FontMenu.svelte';
	import PanelButton from './controls/PanelButton.svelte';
	import MediaPlayButton from './MediaPlayButton.svelte';
	import { layout } from '$lib/shared/layout.svelte';
	import Segmented from './controls/Segmented.svelte';
	import { BASIC_KINDS, shapeIconPath } from './controls/shapeIcons';
	import Slider from './controls/Slider.svelte';
	import ToggleButton from './controls/ToggleButton.svelte';
	import { commonValue, MIXED, optionsFor, type Mixed } from './options';
	import { OPAQUE_SWATCHES, PALETTE_SWATCHES, STICKY_SWATCHES } from './palette';

	const ctx = getBoard();
	const { selection, store, viewport, tools } = ctx;

	const ABOVE_GAP = 44; // clears the rotate handle
	const BELOW_GAP = 16;
	const EDGE = 8;

	const els = $derived.by(() => {
		void store.version;
		return [...selection.ids].map((id) => store.get(id)).filter((e): e is Element => !!e);
	});
	const editable = $derived(els.filter((e) => !e.locked));
	const opts = $derived(optionsFor(editable.map((e) => e.type)));
	const arrangeable = $derived.by(() => {
		void store.version;
		void selection.ids.size;
		return transformTargets(ctx).length;
	});
	const visible = $derived(
		editable.length > 0 &&
			(opts.size > 0 || arrangeable >= 2) &&
			tools.current === 'select' &&
			!selection.transforming &&
			!selection.marquee &&
			!selection.editingId
	);

	const val = <T,>(read: (el: Element) => T): T | Mixed => commonValue(editable, read);
	const style = <K extends keyof Style>(k: K) => val((el) => el.style[k]);
	const font = <K extends keyof Style['font']>(k: K) => val((el) => el.style.font[k]);

	function apply(patch: AppearancePatch, continuous = false) {
		applyStyle(
			ctx,
			editable.map((e) => e.id),
			patch,
			{ continuous }
		);
	}

	// --- positioning: centered above the selection, flipped below near the top, clamped ---------
	let barW = $state(0);
	let barH = $state(0);
	const pos = $derived.by(() => {
		const rects = editable.flatMap((e) => store.index.get(e.id) ?? []);
		const b = unionRects(rects);
		if (!b) return null;
		void [viewport.x, viewport.y, viewport.zoom];
		// Phones: docked at the bottom of the canvas, above the toolbar (panels open as sheets).
		if (layout.compact)
			return {
				left: Math.max(EDGE, (viewport.size.w - barW) / 2),
				top: viewport.size.h - barH - EDGE
			};
		const tl = worldToScreen(viewport.vp, { x: b.x, y: b.y });
		const br = worldToScreen(viewport.vp, { x: b.x + b.w, y: b.y + b.h });
		let top = tl.y - ABOVE_GAP - barH;
		if (top < EDGE) top = br.y + BELOW_GAP;
		top = Math.min(Math.max(EDGE, top), viewport.size.h - barH - EDGE);
		const left = Math.min(
			Math.max(EDGE, (tl.x + br.x) / 2 - barW / 2),
			viewport.size.w - barW - EDGE
		);
		return { left, top };
	});

	const fill = $derived(style('fill'));
	const stroke = $derived(style('stroke'));
	const swatch = (c: string | Mixed) =>
		c === MIXED ? 'conic-gradient(#e03131,#2f9e44,#1971c2,#e03131)' : c;
	const hasText = $derived(
		opts.has('fontSize') ||
			opts.has('fontFamily') ||
			opts.has('textColor') ||
			opts.has('align') ||
			opts.has('fontStyle')
	);
	const hasMore = $derived(opts.has('radius') || opts.has('shadow') || opts.has('opacity'));
	const kind = $derived(val((el) => (el.type === 'shape' ? el.kind : null)));
	const hasQuick = $derived(opts.has('fill') || opts.has('stroke') || opts.has('textColor'));
	// "Set as default" applies when everything selected is one type.
	const singleType = $derived(
		editable.length > 0 && editable.every((e) => e.type === editable[0]!.type)
			? editable[0]!.type
			: null
	);
	const TYPE_LABEL: Record<string, string> = {
		shape: 'shapes',
		sticky: 'sticky notes',
		text: 'texts',
		image: 'images',
		stroke: 'drawings',
		frame: 'frames',
		doccard: 'doc cards',
		connector: 'connectors',
		media: 'media'
	};
	const mediaId = $derived(
		editable.length === 1 && editable[0]!.type === 'media' ? editable[0]!.id : null
	);
	let defaultsVersion = $state(0);
	const customDefault = $derived.by(() => {
		void defaultsVersion;
		return singleType ? hasCustomDefault(singleType) : false;
	});
</script>

{#if visible && pos}
	<div
		role="toolbar"
		aria-label="Style"
		data-interactive
		data-testid="style-popover"
		bind:offsetWidth={barW}
		bind:offsetHeight={barH}
		class="pointer-events-auto absolute z-30 flex items-center gap-0.5 rounded-xl border border-border bg-surface p-1 shadow-lg"
		style:left="{pos.left}px"
		style:top="{pos.top}px"
	>
		{#if mediaId}
			<MediaPlayButton id={mediaId} />
		{/if}
		{#if hasQuick}
			<PanelButton label="Quick styles" testId="style-quick">
				{#snippet trigger()}<Palette class="size-4" aria-hidden="true" />{/snippet}
				<QuickStylesPanel els={editable} {opts} />
			</PanelButton>
		{/if}

		{#if opts.has('routing')}
			<PanelButton label="Connector" testId="style-connector">
				{#snippet trigger()}<Spline class="size-4" aria-hidden="true" />{/snippet}
				<ConnectorPanel els={editable} {apply} />
			</PanelButton>
		{/if}

		{#if opts.has('shapeKind')}
			<PanelButton label="Shape" testId="style-shape">
				{#snippet trigger()}
					<svg viewBox="-1 -1 18 14" class="size-4" aria-hidden="true">
						<path
							d={shapeIconPath(kind === MIXED || !kind ? 'rect' : (kind as ShapeKind))}
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
						/>
					</svg>
				{/snippet}
				<div role="radiogroup" aria-label="Shape" class="grid grid-cols-6 gap-1">
					{#each BASIC_KINDS as k (k.kind)}
						<button
							type="button"
							role="radio"
							aria-checked={kind === k.kind}
							aria-label={k.label}
							title={k.label}
							onclick={() => apply({ kind: k.kind })}
							class="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 aria-checked:bg-accent/15 aria-checked:text-accent"
						>
							<svg viewBox="-1 -1 18 14" class="size-5" aria-hidden="true">
								<path
									d={shapeIconPath(k.kind)}
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
								/>
							</svg>
						</button>
					{/each}
				</div>
			</PanelButton>
		{/if}

		{#if opts.has('stickyColor')}
			{@const color = val((el) => (el.type === 'sticky' ? el.color : ''))}
			<PanelButton label="Sticky color" testId="style-sticky">
				{#snippet trigger()}
					<span class="size-5 rounded border border-border" style:background={swatch(color)}></span>
				{/snippet}
				<ColorSwatches
					value={color}
					colors={STICKY_SWATCHES}
					label="Sticky color"
					onchange={(c) => apply({ color: c })}
				/>
			</PanelButton>
		{/if}

		{#if opts.has('fill')}
			<PanelButton label="Fill" testId="style-fill">
				{#snippet trigger()}
					<span class="size-5 rounded-full border border-border" style:background={swatch(fill)}
					></span>
				{/snippet}
				<ColorSwatches
					value={fill}
					colors={PALETTE_SWATCHES}
					label="Fill color"
					onchange={(c) => apply({ style: { fill: c } })}
				/>
				{#if opts.has('fillStyle')}
					<Segmented
						label="Fill style"
						value={style('fillStyle')}
						options={[
							{ value: 'none', label: 'No fill', text: 'None' },
							{ value: 'semi', label: 'Semi-transparent', text: 'Semi' },
							{ value: 'solid', label: 'Solid', text: 'Solid' }
						]}
						onchange={(v) => apply({ style: { fillStyle: v } })}
					/>
				{/if}
			</PanelButton>
		{/if}

		<button
			type="button"
			aria-label="Save as image"
			title="Save as image"
			data-testid="style-export"
			class="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
			onclick={() => exportDialog.show(exportDialog.format, 'selection')}
		>
			<Download class="size-4" aria-hidden="true" />
		</button>

		{#if opts.has('stroke')}
			<PanelButton label="Stroke" testId="style-stroke">
				{#snippet trigger()}
					<span
						class="size-5 rounded-full border-[3px] bg-surface"
						style:border-color={stroke === MIXED ? 'var(--text-muted)' : stroke}
					></span>
				{/snippet}
				<ColorSwatches
					value={stroke}
					colors={PALETTE_SWATCHES}
					label="Stroke color"
					onchange={(c) => apply({ style: { stroke: c } })}
				/>
				{#if opts.has('strokeWidth')}
					<Segmented
						label="Stroke width"
						value={style('strokeWidth')}
						options={[
							{ value: 1, label: 'Thin', text: 'S' },
							{ value: 2, label: 'Medium', text: 'M' },
							{ value: 4, label: 'Thick', text: 'L' },
							{ value: 8, label: 'Extra thick', text: 'XL' }
						]}
						onchange={(v) => apply({ style: { strokeWidth: v } })}
					/>
				{/if}
				{#if opts.has('dash')}
					<Segmented
						label="Stroke style"
						value={style('dash')}
						options={[
							{ value: 'solid', label: 'Solid', text: '—' },
							{ value: 'dashed', label: 'Dashed', text: '- -' },
							{ value: 'dotted', label: 'Dotted', text: '···' }
						]}
						onchange={(v) => apply({ style: { dash: v } })}
					/>
				{/if}
			</PanelButton>
		{/if}

		{#if hasText}
			<PanelButton label="Text" testId="style-text">
				{#snippet trigger()}<span class="px-0.5 text-sm font-semibold">Aa</span>{/snippet}
				{#if opts.has('fontSize')}
					<Segmented
						label="Font size"
						value={font('size')}
						options={[
							{ value: 's', label: 'Small', text: 'S' },
							{ value: 'm', label: 'Medium', text: 'M' },
							{ value: 'l', label: 'Large', text: 'L' },
							{ value: 'xl', label: 'Extra large', text: 'XL' }
						]}
						onchange={(v) => apply({ style: { font: { size: v } } })}
					/>
				{/if}
				<div class="flex items-center gap-2">
					{#if opts.has('fontStyle')}
						<ToggleButton
							label="Bold"
							icon={Bold}
							pressed={font('bold') === true}
							onchange={(v) => apply({ style: { font: { bold: v } } })}
						/>
						<ToggleButton
							label="Italic"
							icon={Italic}
							pressed={font('italic') === true}
							onchange={(v) => apply({ style: { font: { italic: v } } })}
						/>
					{/if}
					{#if opts.has('align')}
						<Segmented
							label="Text align"
							value={font('align')}
							options={[
								{ value: 'l', label: 'Align left', icon: AlignLeft },
								{ value: 'c', label: 'Align center', icon: AlignCenter },
								{ value: 'r', label: 'Align right', icon: AlignRight }
							]}
							onchange={(v) => apply({ style: { font: { align: v } } })}
						/>
					{/if}
				</div>
				{#if opts.has('valign')}
					<Segmented
						label="Vertical align"
						value={font('valign')}
						options={[
							{ value: 't', label: 'Top', text: 'Top' },
							{ value: 'm', label: 'Middle', text: 'Middle' },
							{ value: 'b', label: 'Bottom', text: 'Bottom' }
						]}
						onchange={(v) => apply({ style: { font: { valign: v } } })}
					/>
				{/if}
				{#if opts.has('fontFamily')}
					<FontMenu
						value={font('family')}
						onchange={(id) => apply({ style: { font: { family: id } } })}
						triggerClass="inline-flex h-8 w-full items-center justify-between gap-1 rounded-md border border-border px-2 text-sm text-text hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
					/>
				{/if}
				{#if opts.has('textColor')}
					<ColorSwatches
						value={font('color')}
						colors={OPAQUE_SWATCHES}
						label="Text color"
						onchange={(c) => apply({ style: { font: { color: c } } })}
					/>
				{/if}
			</PanelButton>
		{/if}

		{#if arrangeable >= 2}
			<PanelButton label="Arrange" testId="style-arrange">
				{#snippet trigger()}<LayoutPanelLeft class="size-4" aria-hidden="true" />{/snippet}
				<ArrangePanel count={arrangeable} />
			</PanelButton>
		{/if}

		{#if hasMore || singleType}
			<PanelButton label="More options" testId="style-more">
				{#snippet trigger()}<Ellipsis class="size-4" aria-hidden="true" />{/snippet}
				{#if opts.has('radius')}
					<Segmented
						label="Corners"
						value={style('radius')}
						options={[
							{ value: 'none', label: 'Sharp corners', text: 'Sharp' },
							{ value: 'sm', label: 'Rounded corners', text: 'Round' },
							{ value: 'lg', label: 'Very rounded corners', text: 'Pill' }
						]}
						onchange={(v) => apply({ style: { radius: v } })}
					/>
				{/if}
				{#if opts.has('shadow')}
					<label class="flex items-center justify-between gap-6 text-xs text-muted">
						Shadow
						<input
							type="checkbox"
							class="size-4 accent-[var(--accent)]"
							checked={style('shadow') === true}
							onchange={(e) => apply({ style: { shadow: e.currentTarget.checked } })}
						/>
					</label>
				{/if}
				{#if opts.has('opacity')}
					<Slider
						label="Opacity"
						min={0.1}
						max={1}
						step={0.1}
						value={style('opacity')}
						format={(v) => `${Math.round(v * 100)}%`}
						onstart={() => ctx.undo.stopCapturing()}
						oninput={(v) => apply({ style: { opacity: v } }, true)}
					/>
				{/if}
				{#if singleType}
					<div class="flex flex-col items-start gap-1 border-t border-border pt-2 text-xs">
						<button
							type="button"
							class="rounded px-1 py-0.5 text-accent hover:underline"
							onclick={() => {
								const first = editable[0]!;
								setDefaultStyle(singleType, first.style);
								if (first.type === 'connector') {
									setConnectorDefaults({
										routing: first.routing,
										markerStart: first.markerStart,
										markerEnd: first.markerEnd
									});
								}
								defaultsVersion++;
							}}
						>
							Set as default for new {TYPE_LABEL[singleType]}
						</button>
						{#if customDefault}
							<button
								type="button"
								class="rounded px-1 py-0.5 text-muted hover:underline"
								onclick={() => {
									resetDefaultStyle(singleType);
									if (singleType === 'connector') resetConnectorDefaults();
									defaultsVersion++;
								}}
							>
								Reset default
							</button>
						{/if}
					</div>
				{/if}
			</PanelButton>
		{/if}
	</div>
{/if}
