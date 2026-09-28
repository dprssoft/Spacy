<script lang="ts">
	import { page } from '$app/state';
	import BoardPage from '$lib/board/BoardPage.svelte';

	const id = $derived(page.params.id ?? '');
</script>

{#key id}
	<BoardPage {id} />
{/key}
