<script lang="ts">
	import { Popover } from 'bits-ui';
	import type { Snippet } from 'svelte';

	let {
		label,
		trigger,
		children,
		testId
	}: { label: string; trigger: Snippet; children: Snippet; testId?: string } = $props();
</script>

<Popover.Root>
	<Popover.Trigger
		aria-label={label}
		title={label}
		data-testid={testId}
		class="inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1 text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none data-[state=open]:bg-surface-2 data-[state=open]:text-text"
	>
		{@render trigger()}
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content
			side="top"
			sideOffset={8}
			collisionPadding={8}
			data-interactive
			class="z-50 flex w-max max-w-72 flex-col items-start gap-3 rounded-xl border border-border bg-surface p-3 shadow-lg"
		>
			{@render children()}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
