<script lang="ts">
	import Archive from '@lucide/svelte/icons/archive';
	import { backupAll } from './fileActions';

	let busy = $state(false);
</script>

<button
	type="button"
	class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-50"
	disabled={busy}
	onclick={async () => {
		busy = true;
		try {
			await backupAll();
		} finally {
			busy = false;
		}
	}}
>
	<Archive class="size-4" aria-hidden="true" />
	{busy ? 'Backing up…' : 'Backup all boards'}
</button>
