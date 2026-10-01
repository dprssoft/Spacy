<script lang="ts">
	import Upload from '@lucide/svelte/icons/upload';
	import { importFiles } from './fileActions';

	let { class: className = '' }: { class?: string } = $props();
	let input = $state<HTMLInputElement>();
</script>

<button
	type="button"
	class={className}
	aria-label="Import boards"
	title="Import .smthng files"
	onclick={() => input?.click()}
>
	<Upload class="size-[18px]" aria-hidden="true" />
</button>
<input
	bind:this={input}
	type="file"
	accept=".smthng,application/json"
	multiple
	hidden
	data-testid="import-input"
	onchange={async (e) => {
		const files = [...(e.currentTarget.files ?? [])];
		e.currentTarget.value = '';
		await importFiles(files);
	}}
/>
