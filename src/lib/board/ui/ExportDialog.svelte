<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { getMeta } from '$lib/model/doc';
	import { downloadBlob } from '$lib/shared/download';
	import { slug } from '$lib/shared/slug';
	import { getBoard } from '../context';
	import { toast } from 'svelte-sonner';
	import {
		copyImage,
		exportRaster,
		exportSvg,
		rasterExtension,
		renderScope,
		svgBlob,
		type ExportScope
	} from '../render/exportImage';
	import { exportDialog, type ExportFormat } from './exportDialogState.svelte';

	const ctx = getBoard();

	let scale = $state<1 | 2 | 3>(2);
	let background = $state<'transparent' | 'white'>('white');
	let withWaystones = $state(false);
	let frameId = $state<string | null>(null);
	let busy = $state(false);
	let previewUrl = $state<string | null>(null);

	const frames = $derived(
		ctx.store.frameOrder.flatMap((id) => {
			const el = ctx.store.get(id);
			return el?.type === 'frame' ? [{ id, title: el.title || 'Frame' }] : [];
		})
	);
	const hasSelection = $derived(ctx.selection.size > 0);
	const hasWaystones = $derived(ctx.waystones.route.length > 0);
	// JPG has no transparency: the browser would turn it black.
	const opaque = $derived(exportDialog.format === 'jpg');
	const bg = $derived(opaque || background === 'white' ? '#ffffff' : 'transparent');

	const scope = $derived.by((): ExportScope | null => {
		if (exportDialog.scope === 'selection') return hasSelection ? { kind: 'selection' } : null;
		if (exportDialog.scope === 'frame') {
			const id = frameId ?? frames[0]?.id;
			return id ? { kind: 'frame', id } : null;
		}
		return { kind: 'board' };
	});

	// Preview (the SVG as an image), re-rendered when the options change.
	$effect(() => {
		if (!exportDialog.open || !scope) {
			previewUrl = null;
			return;
		}
		let alive = true;
		let url: string | null = null;
		void renderScope(ctx, scope, { background: bg, waystones: withWaystones }).then((out) => {
			if (!alive || !out) return;
			url = URL.createObjectURL(svgBlob(out.svg));
			previewUrl = url;
		});
		return () => {
			alive = false;
			if (url) URL.revokeObjectURL(url);
		};
	});

	function filename(extension: string, s: ExportScope): string {
		const title = slug(String(getMeta(ctx.doc).get('title') ?? '')) || 'board';
		const suffix =
			s.kind === 'selection'
				? '-selection'
				: s.kind === 'frame'
					? `-${slug(frames.find((f) => f.id === s.id)?.title ?? '') || 'frame'}`
					: // The current page; named in the file only when the board has several.
						ctx.pages.list.length > 1
						? `-${slug(ctx.pages.page.name) || 'page'}`
						: '';
		return `${title}${suffix}.${extension}`;
	}

	async function download() {
		const s = scope;
		if (!s || busy) return;
		busy = true;
		try {
			const format = exportDialog.format;
			if (format === 'svg') {
				const blob = await exportSvg(ctx, s, bg, withWaystones);
				if (blob) downloadBlob(blob, filename('svg', s));
			} else {
				const blob = await exportRaster(ctx, s, format, scale, bg, withWaystones);
				if (blob) {
					const extension = rasterExtension(blob);
					if (extension !== format)
						toast(`This browser can't write ${format.toUpperCase()}: saved as PNG instead.`);
					downloadBlob(blob, filename(extension, s));
				}
			}
			exportDialog.open = false;
		} finally {
			busy = false;
		}
	}

	async function copy() {
		const s = scope;
		if (!s || busy) return;
		busy = true;
		try {
			if (await copyImage(ctx, s, scale, bg, withWaystones)) exportDialog.open = false;
		} finally {
			busy = false;
		}
	}

	const segment =
		'flex-1 rounded-md px-2 py-1 text-sm aria-checked:bg-surface aria-checked:shadow-sm aria-disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none';
	const group = 'flex gap-1 rounded-lg bg-surface-2 p-1';
	const label = 'mb-1.5 text-xs font-medium text-muted';
</script>

{#snippet choice<T>(
	name: string,
	options: { value: T; label: string; disabled?: boolean }[],
	value: T,
	set: (v: T) => void
)}
	<div role="radiogroup" aria-label={name} class={group}>
		{#each options as o (o.label)}
			<button
				type="button"
				role="radio"
				class={segment}
				aria-checked={o.value === value}
				aria-disabled={o.disabled}
				disabled={o.disabled}
				onclick={() => set(o.value)}>{o.label}</button
			>
		{/each}
	</div>
{/snippet}

<Dialog.Root bind:open={exportDialog.open}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 flex max-h-[92dvh] w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-surface p-5 shadow-xl"
		>
			<Dialog.Title class="text-base font-semibold">Export image</Dialog.Title>
			<div
				class="flex h-48 items-center justify-center overflow-hidden rounded-lg border border-border"
				style:background-image="repeating-conic-gradient(var(--surface-2) 0 25%, transparent 0 50%)"
				style:background-size="16px 16px"
			>
				{#if previewUrl}
					<img src={previewUrl} alt="Export preview" class="max-h-full max-w-full object-contain" />
				{:else}
					<p class="text-sm text-muted">Nothing to export</p>
				{/if}
			</div>
			<div>
				<p class={label}>Format</p>
				{@render choice<ExportFormat>(
					'Format',
					[
						{ value: 'png', label: 'PNG' },
						{ value: 'jpg', label: 'JPG' },
						{ value: 'webp', label: 'WebP' },
						{ value: 'svg', label: 'SVG' }
					],
					exportDialog.format,
					(v) => (exportDialog.format = v)
				)}
			</div>
			<div>
				<p class={label}>Area</p>
				{@render choice<ExportScope['kind']>(
					'Area',
					[
						{ value: 'board', label: 'Page' },
						{ value: 'selection', label: 'Selection', disabled: !hasSelection },
						{ value: 'frame', label: 'Frame', disabled: frames.length === 0 }
					],
					exportDialog.scope,
					(v) => (exportDialog.scope = v)
				)}
				{#if exportDialog.scope === 'frame' && frames.length > 0}
					<select
						aria-label="Frame"
						class="mt-2 h-8 w-full rounded-md border border-border bg-surface px-2 text-sm"
						value={frameId ?? frames[0]?.id}
						onchange={(e) => (frameId = e.currentTarget.value)}
					>
						{#each frames as f (f.id)}<option value={f.id}>{f.title}</option>{/each}
					</select>
				{/if}
			</div>
			<div class="grid grid-cols-2 gap-4">
				<div>
					<p class={label}>Background</p>
					{@render choice<'transparent' | 'white'>(
						'Background',
						[
							{ value: 'white', label: 'White' },
							{ value: 'transparent', label: 'Transparent', disabled: opaque }
						],
						opaque ? 'white' : background,
						(v) => (background = v)
					)}
				</div>
				{#if exportDialog.format !== 'svg'}
					<div>
						<p class={label}>Scale</p>
						{@render choice<1 | 2 | 3>(
							'Scale',
							[
								{ value: 1, label: '1×' },
								{ value: 2, label: '2×' },
								{ value: 3, label: '3×' }
							],
							scale,
							(v) => (scale = v)
						)}
					</div>
				{/if}
			</div>
			{#if hasWaystones}
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={withWaystones} data-testid="export-waystones" />
					Include tabs
				</label>
			{/if}
			<div class="flex justify-end gap-2">
				<Dialog.Close
					class="h-9 rounded-lg px-3 text-sm font-medium hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
					>Cancel</Dialog.Close
				>
				<button
					type="button"
					class="h-9 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-50"
					title="Copies as a PNG"
					disabled={!scope || busy}
					onclick={copy}
				>
					Copy image
				</button>
				<button
					type="button"
					class="h-9 rounded-lg bg-accent px-3 text-sm font-medium text-accent-contrast focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none disabled:opacity-50"
					disabled={!scope || busy}
					onclick={download}
				>
					{busy ? 'Exporting…' : 'Download'}
				</button>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
