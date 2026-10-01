<script lang="ts">
	import type { Mixed } from '../options';

	let {
		value,
		min,
		max,
		step,
		label,
		format = (v: number) => String(v),
		oninput,
		onstart
	}: {
		value: number | Mixed;
		min: number;
		max: number;
		step: number;
		label: string;
		format?: (v: number) => string;
		oninput: (value: number) => void;
		/** Called once when a drag starts (begin a new undo step). */
		onstart?: () => void;
	} = $props();
</script>

<label class="flex items-center gap-3 text-xs text-muted">
	<span class="w-14 shrink-0">{label}</span>
	<input
		type="range"
		{min}
		{max}
		{step}
		value={typeof value === 'number' ? value : max}
		aria-label={label}
		onpointerdown={() => onstart?.()}
		onfocus={() => onstart?.()}
		oninput={(e) => oninput(Number(e.currentTarget.value))}
		class="h-1.5 flex-1 cursor-pointer accent-[var(--accent)]"
	/>
	<span class="w-9 text-right tabular-nums">{typeof value === 'number' ? format(value) : '—'}</span>
</label>
