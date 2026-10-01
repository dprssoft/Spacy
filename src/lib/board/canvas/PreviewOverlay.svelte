<script lang="ts">
	import { getBoard } from '../context';
	import { strokeSvgPath } from '../elements/stroke/strokePath';

	const { preview, viewport } = getBoard();

	// The in-progress stroke in screen space: world points scaled by zoom (brush too), then offset.
	const strokePath = $derived(
		preview.stroke ? strokeSvgPath(preview.stroke.points, preview.stroke.width, viewport.zoom) : ''
	);
	const trail = $derived(preview.eraserTrail.map((p) => `${p.x},${p.y}`).join(' '));
</script>

<svg class="absolute inset-0 size-full overflow-visible" aria-hidden="true">
	{#if strokePath}
		<path
			d={strokePath}
			transform="translate({viewport.x} {viewport.y})"
			fill={preview.stroke?.color}
			data-testid="stroke-preview"
		/>
	{/if}
	{#if preview.eraserTrail.length > 1}
		<polyline
			points={trail}
			fill="none"
			stroke="var(--text-muted)"
			stroke-opacity="0.45"
			stroke-width="6"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{/if}
</svg>
