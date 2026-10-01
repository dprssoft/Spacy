<script lang="ts">
	import AlignCenterHorizontal from '@lucide/svelte/icons/align-center-horizontal';
	import AlignCenterVertical from '@lucide/svelte/icons/align-center-vertical';
	import AlignEndHorizontal from '@lucide/svelte/icons/align-end-horizontal';
	import AlignEndVertical from '@lucide/svelte/icons/align-end-vertical';
	import AlignHorizontalDistributeCenter from '@lucide/svelte/icons/align-horizontal-distribute-center';
	import AlignStartHorizontal from '@lucide/svelte/icons/align-start-horizontal';
	import AlignStartVertical from '@lucide/svelte/icons/align-start-vertical';
	import AlignVerticalDistributeCenter from '@lucide/svelte/icons/align-vertical-distribute-center';
	import { arrange, type ArrangeOp } from '../commands/arrange';
	import { getBoard } from '../context';

	let { count }: { count: number } = $props();
	const ctx = getBoard();

	const button =
		'inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-35 disabled:hover:bg-transparent';
	const run = (op: ArrangeOp) => arrange(ctx, op);
</script>

<div class="flex flex-col gap-2">
	<div class="flex gap-0.5" role="group" aria-label="Align">
		<button
			type="button"
			class={button}
			aria-label="Align left"
			title="Align left"
			onclick={() => run({ kind: 'align', edge: 'left' })}
			><AlignStartVertical class="size-4" /></button
		>
		<button
			type="button"
			class={button}
			aria-label="Align center"
			title="Align center"
			onclick={() => run({ kind: 'align', edge: 'hcenter' })}
			><AlignCenterVertical class="size-4" /></button
		>
		<button
			type="button"
			class={button}
			aria-label="Align right"
			title="Align right"
			onclick={() => run({ kind: 'align', edge: 'right' })}
			><AlignEndVertical class="size-4" /></button
		>
		<button
			type="button"
			class={button}
			aria-label="Align top"
			title="Align top"
			onclick={() => run({ kind: 'align', edge: 'top' })}
			><AlignStartHorizontal class="size-4" /></button
		>
		<button
			type="button"
			class={button}
			aria-label="Align middle"
			title="Align middle"
			onclick={() => run({ kind: 'align', edge: 'vcenter' })}
			><AlignCenterHorizontal class="size-4" /></button
		>
		<button
			type="button"
			class={button}
			aria-label="Align bottom"
			title="Align bottom"
			onclick={() => run({ kind: 'align', edge: 'bottom' })}
			><AlignEndHorizontal class="size-4" /></button
		>
	</div>
	<div class="flex items-center gap-0.5" role="group" aria-label="Distribute and size">
		<button
			type="button"
			class={button}
			disabled={count < 3}
			aria-label="Distribute horizontally"
			title="Distribute horizontally"
			onclick={() => run({ kind: 'distribute', axis: 'h' })}
			><AlignHorizontalDistributeCenter class="size-4" /></button
		>
		<button
			type="button"
			class={button}
			disabled={count < 3}
			aria-label="Distribute vertically"
			title="Distribute vertically"
			onclick={() => run({ kind: 'distribute', axis: 'v' })}
			><AlignVerticalDistributeCenter class="size-4" /></button
		>
		<span class="mx-1 h-5 w-px bg-border"></span>
		<button
			type="button"
			class="h-8 rounded-md px-2 text-xs text-muted hover:bg-surface-2 hover:text-text"
			onclick={() => run({ kind: 'match', dim: 'w' })}>Same width</button
		>
		<button
			type="button"
			class="h-8 rounded-md px-2 text-xs text-muted hover:bg-surface-2 hover:text-text"
			onclick={() => run({ kind: 'match', dim: 'h' })}>Same height</button
		>
	</div>
</div>
