<script lang="ts">
	import { getBoard } from '../context';
	import { ink } from '../elements/common';
	import { strokeSvgPath } from '../elements/stroke/strokePath';
	import { strokePaint } from '../sketch/brushes';

	const { preview, viewport } = getBoard();

	// The in-progress stroke in screen space: world points scaled by zoom (brush too), then offset.
	const strokePath = $derived(
		preview.stroke ? strokeSvgPath(preview.stroke.points, preview.stroke.width, viewport.zoom) : ''
	);
	const guides = $derived(
		preview.guides.map((g) => {
			const z = viewport.zoom;
			return g.axis === 'x'
				? {
						x1: g.at * z + viewport.x,
						x2: g.at * z + viewport.x,
						y1: g.from * z + viewport.y,
						y2: g.to * z + viewport.y
					}
				: {
						x1: g.from * z + viewport.x,
						x2: g.to * z + viewport.x,
						y1: g.at * z + viewport.y,
						y2: g.at * z + viewport.y
					};
		})
	);
	// Equal gaps in screen space: the gap's line, a cap at each end and its width in board units.
	const gaps = $derived(
		preview.gaps.map((g) => {
			const z = viewport.zoom;
			const [a, b, at] = [g.from * z, g.to * z, g.at * z];
			const label = String(Math.round(g.to - g.from));
			return g.axis === 'x'
				? {
						d: `M${a + viewport.x} ${at + viewport.y - 5} v10 M${b + viewport.x} ${at + viewport.y - 5} v10 M${a + viewport.x} ${at + viewport.y} H${b + viewport.x}`,
						cx: (a + b) / 2 + viewport.x,
						cy: at + viewport.y + 12,
						label
					}
				: {
						d: `M${at + viewport.x - 5} ${a + viewport.y} h10 M${at + viewport.x - 5} ${b + viewport.y} h10 M${at + viewport.x} ${a + viewport.y} V${b + viewport.y}`,
						cx: at + viewport.x + 8 + label.length * 3.5,
						cy: (a + b) / 2 + viewport.y,
						label
					};
		})
	);
	// The brush stroke in progress. An eraser can't erase in this overlay, so it shows as a grey
	// band; the real erasing happens when the stroke is committed.
	const sketchPaint = $derived(preview.sketch ? strokePaint(preview.sketch) : null);
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
	{#if sketchPaint}
		<path
			d={sketchPaint.d}
			transform="translate({viewport.x} {viewport.y}) scale({viewport.zoom})"
			fill={sketchPaint.mode === 'fill' ? ink(sketchPaint.color) : 'none'}
			stroke={sketchPaint.mode === 'stroke'
				? sketchPaint.erase
					? 'var(--text-muted)'
					: ink(sketchPaint.color)
				: 'none'}
			stroke-width={sketchPaint.width}
			stroke-linecap={sketchPaint.cap}
			stroke-linejoin="round"
			opacity={sketchPaint.erase ? 0.3 : sketchPaint.opacity}
			data-testid="sketch-preview"
		/>
	{/if}
	{#each guides as g, i (i)}
		<line {...g} stroke="#e03131" stroke-width="1" data-testid="snap-guide" />
		<path
			d="M{g.x1 - 3} {g.y1 - 3} l6 6 m0 -6 l-6 6 M{g.x2 - 3} {g.y2 - 3} l6 6 m0 -6 l-6 6"
			stroke="#e03131"
			stroke-width="1"
		/>
	{/each}
	{#each gaps as g, i (i)}
		<g data-testid="snap-gap">
			<path d={g.d} stroke="#e03131" stroke-width="1.5" fill="none" />
			<rect
				x={g.cx - 4 - g.label.length * 3.5}
				y={g.cy - 8}
				width={8 + g.label.length * 7}
				height="16"
				rx="4"
				fill="#e03131"
			/>
			<text
				x={g.cx}
				y={g.cy}
				fill="#fff"
				font-size="11"
				text-anchor="middle"
				dominant-baseline="central">{g.label}</text
			>
		</g>
	{/each}
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
