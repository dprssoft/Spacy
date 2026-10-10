<script lang="ts">
	import { driveSync } from '$lib/sync/driveSync.svelte';
	import ShieldAlert from '@lucide/svelte/icons/shield-alert';
	import { getPref, setPref } from '$lib/shared/localPrefs';
	import * as boardsRepo from '$lib/storage/boardsRepo';
	import { onBoardsChanged } from '$lib/storage/channels';
	import { LAST_BACKUP_PREF } from '$lib/storage/backupPrefs';
	import { DISMISSED_PREF, shouldShowBackupReminder } from './backupReminder';
	import { backupAll } from './fileActions';

	let boardCount = $state(0);
	// Bumped after "Back up now" / "Later" so the prefs are read again.
	let tick = $state(0);
	let busy = $state(false);

	$effect(() => {
		const count = () =>
			void boardsRepo
				.list({ filter: 'all', sort: 'created' })
				.then((all) => (boardCount = all.length))
				.catch(() => {});
		count();
		return onBoardsChanged(count);
	});

	const show = $derived.by(() => {
		void tick;
		return shouldShowBackupReminder({
			boardCount,
			lastBackupAt: getPref<number | null>(LAST_BACKUP_PREF, null),
			dismissedAt: getPref<number | null>(DISMISSED_PREF, null),
			now: Date.now()
		});
	});
</script>

{#if show}
	<div
		role="status"
		class="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm"
		data-testid="backup-reminder"
	>
		<ShieldAlert class="size-5 shrink-0 text-accent" aria-hidden="true" />
		<p class="min-w-0 flex-1">
			{#if driveSync.connected}Your boards sync through your Google Drive. A backup file is still a
				good extra copy.{:else}Your boards live only in this browser. Back up to keep a copy.{/if}
		</p>
		<button
			type="button"
			class="h-8 rounded-lg px-3 font-medium text-muted hover:bg-surface-2 hover:text-text"
			onclick={() => {
				setPref(DISMISSED_PREF, Date.now());
				tick++;
			}}>Later</button
		>
		<button
			type="button"
			class="h-8 rounded-lg bg-accent px-3 font-medium text-accent-contrast disabled:opacity-60"
			disabled={busy}
			onclick={async () => {
				busy = true;
				try {
					await backupAll();
				} finally {
					busy = false;
					tick++;
				}
			}}>Back up now</button
		>
	</div>
{/if}
