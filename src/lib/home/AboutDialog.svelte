<script lang="ts">
	import { Dialog } from 'bits-ui';
	import Logo from '$lib/shared/ui/Logo.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	// Placeholder until the project has a public home.
	const REPOSITORY = 'https://github.com/your-org/spacy';
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-6 text-center shadow-xl"
		>
			<Logo class="mx-auto size-12" />
			<Dialog.Title class="mt-3 text-base font-semibold">Spacy</Dialog.Title>
			<p class="text-sm text-muted">Version {__APP_VERSION__}</p>
			<Dialog.Description class="mt-4 text-sm">
				Boards are stored only in this browser. Back up regularly.
			</Dialog.Description>
			<a
				href={REPOSITORY}
				target="_blank"
				rel="noopener noreferrer external"
				class="mt-3 inline-block text-sm text-accent underline underline-offset-2">Source code</a
			>
			<div class="mt-5">
				<Dialog.Close
					class="h-9 rounded-lg bg-surface-2 px-4 text-sm font-medium hover:bg-border focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
					>Close</Dialog.Close
				>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
