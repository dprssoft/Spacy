<script lang="ts">
	import { formatTime } from './poster';

	let {
		time,
		duration,
		buffered,
		start,
		end,
		onseek
	}: {
		time: number;
		duration: number;
		buffered: number;
		start: number;
		end: number | null;
		onseek: (seconds: number) => void;
	} = $props();

	let track = $state<HTMLDivElement>();
	let hover = $state<number | null>(null);
	let dragging = $state(false);
	let frame = 0;
	let pending: number | null = null;

	const pct = (t: number) => (duration > 0 ? Math.min(100, Math.max(0, (t / duration) * 100)) : 0);
	const at = (clientX: number) => {
		const r = track!.getBoundingClientRect();
		return Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * duration;
	};
	// At most one seek per frame while dragging.
	function seekSoon(t: number) {
		pending = t;
		if (frame) return;
		frame = requestAnimationFrame(() => {
			frame = 0;
			if (pending !== null) onseek(pending);
			pending = null;
		});
	}

	function down(e: PointerEvent) {
		if (!duration || !track) return;
		dragging = true;
		track.setPointerCapture(e.pointerId);
		seekSoon(at(e.clientX));
	}
	function move(e: PointerEvent) {
		if (!duration || !track) return;
		hover = at(e.clientX);
		if (dragging) seekSoon(hover);
	}
	function up() {
		dragging = false;
	}
	function key(e: KeyboardEvent) {
		const step = { ArrowLeft: -5, ArrowRight: 5, PageDown: -30, PageUp: 30 }[e.key];
		if (step !== undefined) onseek(Math.max(0, time + step));
		else if (e.key === 'Home') onseek(start);
		else if (e.key === 'End' && duration) onseek(end ?? Math.max(0, duration - 1));
		else return;
		e.preventDefault();
		e.stopPropagation();
	}
</script>

<div
	bind:this={track}
	role="slider"
	tabindex="0"
	aria-label="Seek"
	aria-valuemin={0}
	aria-valuemax={Math.round(duration)}
	aria-valuenow={Math.round(time)}
	aria-valuetext="{formatTime(time)} of {formatTime(duration)}"
	data-testid="media-scrubber"
	class="group relative h-5 min-w-16 flex-1 cursor-pointer touch-none rounded focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointerleave={() => (hover = null)}
	onkeydown={key}
>
	<div
		class="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-text/15"
	>
		<div class="absolute inset-y-0 left-0 bg-text/20" style:width="{buffered * 100}%"></div>
		<div class="absolute inset-y-0 left-0 bg-accent" style:width="{pct(time)}%"></div>
		{#if start > 0 || end !== null}
			<!-- Outside the clip is dimmed. -->
			<div class="absolute inset-y-0 left-0 bg-surface/70" style:width="{pct(start)}%"></div>
			{#if end !== null}
				<div class="absolute inset-y-0 right-0 bg-surface/70" style:left="{pct(end)}%"></div>
			{/if}
		{/if}
	</div>
	{#if start > 0}
		<div
			class="absolute top-0.5 bottom-0.5 w-0.5 rounded bg-accent"
			style:left="{pct(start)}%"
			data-clip-start
		></div>
	{/if}
	{#if end !== null}
		<div
			class="absolute top-0.5 bottom-0.5 w-0.5 rounded bg-accent"
			style:left="{pct(end)}%"
			data-clip-end
		></div>
	{/if}
	<div
		class="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
		class:opacity-100={dragging}
		style:left="{pct(time)}%"
	></div>
	{#if hover !== null}
		<div
			class="pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-text px-1.5 py-0.5 text-xs text-bg tabular-nums"
			style:left="{pct(hover)}%"
		>
			{formatTime(hover)}
		</div>
	{/if}
</div>
