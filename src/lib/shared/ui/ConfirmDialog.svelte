<script lang="ts">
	import { AlertDialog } from 'bits-ui';

	let {
		open = $bindable(false),
		title,
		description,
		confirmLabel = 'Confirm',
		danger = false,
		onConfirm
	}: {
		open?: boolean;
		title: string;
		description: string;
		confirmLabel?: string;
		danger?: boolean;
		onConfirm: () => void;
	} = $props();
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Portal>
		<AlertDialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<AlertDialog.Content
			class="fixed top-1/2 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-5 shadow-xl"
		>
			<AlertDialog.Title class="text-base font-semibold">{title}</AlertDialog.Title>
			<AlertDialog.Description class="mt-2 text-sm text-muted"
				>{description}</AlertDialog.Description
			>
			<div class="mt-5 flex justify-end gap-2">
				<AlertDialog.Cancel
					class="h-9 rounded-lg px-3 text-sm font-medium hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
				>
					Cancel
				</AlertDialog.Cancel>
				<AlertDialog.Action
					onclick={() => {
						// Confirm first: closing can reset state the handler still needs (bound `open`).
						onConfirm();
						open = false;
					}}
					class="h-9 rounded-lg px-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none {danger
						? 'bg-danger text-white focus-visible:ring-danger'
						: 'bg-accent text-accent-contrast focus-visible:ring-accent'}"
				>
					{confirmLabel}
				</AlertDialog.Action>
			</div>
		</AlertDialog.Content>
	</AlertDialog.Portal>
</AlertDialog.Root>
