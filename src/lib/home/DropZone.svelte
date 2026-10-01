<script lang="ts">
	import Upload from '@lucide/svelte/icons/upload';
	import { dragHasFiles, importFiles } from './fileActions';

	// Counts nested dragenter/dragleave pairs so the overlay doesn't flicker over child elements.
	let depth = $state(0);

	function ondragenter(e: DragEvent) {
		if (!dragHasFiles(e)) return;
		e.preventDefault();
		depth++;
	}
	function ondragover(e: DragEvent) {
		if (!dragHasFiles(e)) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
	}
	function ondragleave(e: DragEvent) {
		if (dragHasFiles(e)) depth = Math.max(0, depth - 1);
	}
	function ondrop(e: DragEvent) {
		if (!dragHasFiles(e)) return;
		e.preventDefault();
		depth = 0;
		void importFiles([...(e.dataTransfer?.files ?? [])]);
	}
</script>

<svelte:window {ondragenter} {ondragover} {ondragleave} {ondrop} />

{#if depth > 0}
	<div
		class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-6 backdrop-blur-sm"
		role="presentation"
	>
		<div
			class="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-accent px-10 py-8 text-center"
		>
			<Upload class="size-8 text-accent" aria-hidden="true" />
			<p class="text-base font-medium">Drop .smthng files to import</p>
		</div>
	</div>
{/if}
