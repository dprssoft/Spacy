<script lang="ts">
	import type { ShapeElement } from '$lib/model/types';
	import {
		dashArray,
		fillColor,
		fontToCss,
		ink,
		inkFont,
		radiusPx,
		seeThrough,
		valignToJustify
	} from '../common';
	import type { ElementViewProps } from '../registry';
	import { isLineArt, shapePathMemo } from './paths';

	let { el, editing }: ElementViewProps<ShapeElement> = $props();

	const pathFor = shapePathMemo();
	const d = $derived(pathFor(el.kind, el.w, el.h, radiusPx(el.style), el.style.strokeWidth / 2));
</script>

<svg width={el.w} height={el.h} class="absolute inset-0 overflow-visible" aria-hidden="true">
	<path
		{d}
		fill={isLineArt(el.kind) ? 'none' : fillColor(el.style)}
		stroke={ink(el.style.stroke)}
		stroke-width={el.style.strokeWidth}
		stroke-dasharray={dashArray(el.style.dash, el.style.strokeWidth)}
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
</svg>
{#if !editing && el.text}
	<div
		class="absolute inset-0 flex flex-col overflow-visible p-2 break-words whitespace-pre-wrap"
		style="justify-content:{valignToJustify(el.style.font.valign)};{fontToCss(
			inkFont(el.style.font, isLineArt(el.kind) || seeThrough(el.style))
		)}"
	>
		<div>{el.text}</div>
	</div>
{/if}
