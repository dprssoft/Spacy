<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import * as boardsRepo from '$lib/storage/boardsRepo';

	let pending = $state(false);

	async function createBoard() {
		if (pending) return;
		pending = true;
		try {
			const meta = await boardsRepo.create();
			await goto(resolve('/board/[id]', { id: meta.id }));
		} finally {
			pending = false;
		}
	}
</script>

<button
	type="button"
	onclick={createBoard}
	disabled={pending}
	class="group flex aspect-[16/10] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-accent/50 bg-surface text-accent transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none disabled:opacity-60"
>
	<span
		class="flex size-11 items-center justify-center rounded-full bg-accent text-accent-contrast transition group-hover:scale-105"
	>
		<Plus class="size-6" aria-hidden="true" />
	</span>
	<span class="text-sm font-medium text-text">New board</span>
	<span class="text-xs text-muted">Blank canvas</span>
</button>
