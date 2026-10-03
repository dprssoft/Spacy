<script lang="ts">
	import { Dialog, Popover } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { layout } from '$lib/shared/layout.svelte';

	let {
		label,
		trigger,
		children,
		testId
	}: { label: string; trigger: Snippet; children: Snippet; testId?: string } = $props();

	const triggerClass =
		'inline-flex h-8 min-w-8 pointer-coarse:size-11 items-center justify-center rounded-md px-1 text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none data-[state=open]:bg-surface-2 data-[state=open]:text-text';

	// Phones: the panel is a bottom sheet; drag its handle down (or tap outside) to close it.
	let open = $state(false);
	let dragFrom: number | null = null;
	const SWIPE_CLOSE_PX = 60;
</script>

{#if layout.compact}
	<Dialog.Root bind:open>
		<Dialog.Trigger aria-label={label} title={label} data-testid={testId} class={triggerClass}>
			{@render trigger()}
		</Dialog.Trigger>
		<Dialog.Portal>
			<Dialog.Overlay class="fixed inset-0 z-50 bg-black/20" />
			<Dialog.Content
				data-interactive
				data-testid="style-sheet"
				class="fixed inset-x-0 bottom-0 z-50 flex max-h-[60dvh] flex-col rounded-t-2xl border-t border-border bg-surface shadow-xl"
			>
				<div
					class="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center"
					data-testid="sheet-handle"
					aria-hidden="true"
					onpointerdown={(e) => {
						dragFrom = e.clientY;
						e.currentTarget.setPointerCapture(e.pointerId);
					}}
					onpointermove={(e) => {
						if (dragFrom !== null && e.clientY - dragFrom > SWIPE_CLOSE_PX) {
							dragFrom = null;
							open = false;
						}
					}}
					onpointerup={() => (dragFrom = null)}
				>
					<span class="h-1 w-10 rounded-full bg-border"></span>
				</div>
				<Dialog.Title class="px-4 text-sm font-medium">{label}</Dialog.Title>
				<div
					class="flex flex-col items-start gap-3 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
				>
					{@render children()}
				</div>
			</Dialog.Content>
		</Dialog.Portal>
	</Dialog.Root>
{:else}
	<Popover.Root>
		<Popover.Trigger aria-label={label} title={label} data-testid={testId} class={triggerClass}>
			{@render trigger()}
		</Popover.Trigger>
		<Popover.Portal>
			<Popover.Content
				side="top"
				sideOffset={8}
				collisionPadding={8}
				data-interactive
				class="z-50 flex max-h-(--bits-floating-available-height) w-max max-w-72 flex-col items-start gap-3 overflow-y-auto rounded-xl border border-border bg-surface p-3 shadow-lg"
			>
				{@render children()}
			</Popover.Content>
		</Popover.Portal>
	</Popover.Root>
{/if}
