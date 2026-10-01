<script lang="ts">
	import { ContextMenu } from 'bits-ui';
	import { getMeta } from '$lib/model/doc';
	import type { Element, Style } from '$lib/model/types';
	import { getBoard } from '../context';
	import { applyStyle } from './applyStyle';
	import type { StyleOption } from './options';
	import { DEFAULT_PRESETS, getPresets, presetPatch, updatePreset } from './quickStyles';

	let { els, opts }: { els: Element[]; opts: Set<StyleOption> } = $props();

	const ctx = getBoard();
	// Presets live in the board document (shared), so follow changes from other tabs too.
	let presets = $state<Style[]>(getPresets(ctx.doc));
	$effect(() => {
		const meta = getMeta(ctx.doc);
		const sync = () => (presets = getPresets(ctx.doc));
		meta.observe(sync);
		return () => meta.unobserve(sync);
	});

	function applyPreset(style: Style) {
		applyStyle(
			ctx,
			els.map((e) => e.id),
			{ style: presetPatch(style, opts) }
		);
	}
</script>

<div role="group" aria-label="Quick styles" class="grid grid-cols-4 gap-1.5">
	{#each presets as p, i (i)}
		{@const name = DEFAULT_PRESETS[i]?.name ?? `Style ${i + 1}`}
		<ContextMenu.Root>
			<ContextMenu.Trigger>
				{#snippet child({ props })}
					<button
						{...props}
						type="button"
						aria-label="{name} style"
						title="{name} (right-click to update from selection)"
						onclick={() => applyPreset(p)}
						class="flex size-9 items-center justify-center rounded-md text-sm font-semibold focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
						style:background={p.fillStyle === 'none' ? 'transparent' : p.fill}
						style:border="2px {p.dash === 'solid' ? 'solid' : 'dashed'}
						{p.stroke}"
						style:color={p.font.color}
					>
						A
					</button>
				{/snippet}
			</ContextMenu.Trigger>
			<ContextMenu.Portal>
				<ContextMenu.Content
					class="z-50 rounded-lg border border-border bg-surface p-1 shadow-lg"
					data-interactive
				>
					<ContextMenu.Item
						class="flex h-8 cursor-default items-center rounded-md px-2 text-sm outline-none data-[highlighted]:bg-surface-2"
						onSelect={() => els[0] && updatePreset(ctx.doc, i, els[0].style)}
					>
						Update from selection
					</ContextMenu.Item>
				</ContextMenu.Content>
			</ContextMenu.Portal>
		</ContextMenu.Root>
	{/each}
</div>
