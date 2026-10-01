<script lang="ts">
	import { updateElement } from '$lib/model/ops';
	import type { FrameElement } from '$lib/model/types';
	import { getBoard } from '../../context';
	import { dashArray, fillColor, radiusPx } from '../common';
	import type { ElementViewProps } from '../registry';
	import { FRAME_TITLE_FONT, FRAME_TITLE_H } from './geometry';

	let { el, editing }: ElementViewProps<FrameElement> = $props();

	const ctx = getBoard();
	let draft = $state('');

	function focusTitle(node: HTMLInputElement) {
		draft = el.title;
		node.value = el.title;
		node.focus();
		node.select();
	}

	function commit() {
		const title = draft.trim();
		if (title && title !== el.title) updateElement(ctx.doc, el.id, { title });
		ctx.editing.end();
	}
</script>

<svg width={el.w} height={el.h} class="absolute inset-0 overflow-visible" aria-hidden="true">
	<rect
		x={el.style.strokeWidth / 2}
		y={el.style.strokeWidth / 2}
		width={Math.max(0, el.w - el.style.strokeWidth)}
		height={Math.max(0, el.h - el.style.strokeWidth)}
		rx={radiusPx(el.style)}
		fill={fillColor(el.style)}
		stroke={el.style.stroke}
		stroke-width={el.style.strokeWidth}
		stroke-dasharray={dashArray(el.style.dash, el.style.strokeWidth)}
	/>
</svg>
<div
	class="absolute left-0 flex items-end pb-1"
	style:top="{-FRAME_TITLE_H}px"
	style:height="{FRAME_TITLE_H}px"
	style:font-size="{FRAME_TITLE_FONT}px"
	style:max-width="{Math.max(48, el.w)}px"
>
	{#if editing}
		<input
			{@attach focusTitle}
			bind:value={draft}
			aria-label="Frame title"
			data-interactive
			class="pointer-events-auto rounded border border-accent bg-surface px-1 text-text outline-none"
			style:font-size="{FRAME_TITLE_FONT}px"
			onblur={commit}
			onkeydown={(e) => {
				e.stopPropagation();
				if (e.key === 'Enter') commit();
				if (e.key === 'Escape') {
					draft = el.title;
					ctx.editing.end();
				}
			}}
		/>
	{:else}
		<span class="truncate font-medium whitespace-nowrap text-muted" data-frame-title
			>{el.title}</span
		>
	{/if}
</div>
