<script lang="ts">
	import FileQuestion from '@lucide/svelte/icons/file-question';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { parseShareHash } from '$lib/model/share';
	import { liveSharingAvailable } from '$lib/storage/live/config';
	import { NewerSchemaError } from '$lib/model/migrations';
	import { BoardNotFoundError, openBoard, type OpenBoard } from '$lib/storage/boardDoc';
	import * as boardsRepo from '$lib/storage/boardsRepo';
	import BoardWorkspace from './BoardWorkspace.svelte';
	import { OPEN_MARK } from './openTiming';

	let { id }: { id: string } = $props();

	type Status =
		| { kind: 'loading' }
		/** Opened from a share link; waiting for someone who has the board open. */
		| { kind: 'joining' }
		| { kind: 'ready'; board: OpenBoard }
		| { kind: 'notfound' }
		| { kind: 'trashed' }
		| { kind: 'error'; message: string };

	let status = $state<Status>({ kind: 'loading' });
	let showSpinner = $state(false);
	let destroyed = false;
	let opened: OpenBoard | null = null;
	const joinAbort = new AbortController();

	/** A share link (`#live=…`): add the board here and get its content from the sharer. */
	async function join(): Promise<boolean> {
		const share = parseShareHash(location.hash);
		if (!share) return true;
		if (!liveSharingAvailable()) {
			status = { kind: 'error', message: 'Live sharing isn’t available in this version of Spacy.' };
			return false;
		}
		status = { kind: 'joining' };
		const { joinShared } = await import('$lib/storage/live/join');
		await joinShared(id, share, joinAbort.signal);
		// The key stays out of the address bar and history once used.
		replaceState(resolve('/board/[id]', { id }), {});
		return !destroyed;
	}

	async function load() {
		performance.mark(OPEN_MARK);
		status = { kind: 'loading' };
		try {
			if (!(await join())) return;
			const meta = await boardsRepo.get(id);
			if (!meta) return void (status = { kind: 'notfound' });
			if (meta.deletedAt !== null) return void (status = { kind: 'trashed' });
			const board = await openBoard(id);
			if (destroyed) return void board.close();
			opened = board;
			status = { kind: 'ready', board };
			void boardsRepo.touchOpened(id);
		} catch (err) {
			if (err instanceof BoardNotFoundError) status = { kind: 'notfound' };
			else if (err instanceof NewerSchemaError)
				status = {
					kind: 'error',
					message: 'This board was created with a newer version of Spacy.'
				};
			else {
				console.error(err);
				status = { kind: 'error', message: 'Something went wrong while opening this board.' };
			}
		}
	}

	async function restoreAndOpen() {
		await boardsRepo.restore(id);
		await load();
	}

	$effect(() => {
		void load();
		// Avoid a spinner flash for fast (cached) loads.
		const timer = setTimeout(() => (showSpinner = true), 150);
		return () => {
			destroyed = true;
			joinAbort.abort();
			clearTimeout(timer);
			void opened?.close();
		};
	});

	const button =
		'inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none';
</script>

{#if status.kind === 'ready'}
	<BoardWorkspace board={status.board} />
{:else if status.kind === 'joining'}
	<main
		class="flex h-dvh flex-col items-center justify-center gap-3 p-6 text-center"
		aria-busy="true"
	>
		<div
			class="size-8 animate-spin rounded-full border-2 border-border border-t-accent"
			aria-hidden="true"
		></div>
		<h1 class="text-lg font-medium">Joining a shared board</h1>
		<p class="max-w-sm text-sm text-muted">
			Waiting for someone who has this board open. Ask them to keep it open while you join.
		</p>
		<a href={resolve('/')} class="{button} mt-2 bg-surface-2 hover:bg-border">Back to boards</a>
	</main>
{:else if status.kind === 'loading'}
	<div class="flex h-dvh items-center justify-center" aria-busy="true">
		{#if showSpinner}
			<div
				class="size-8 animate-spin rounded-full border-2 border-border border-t-accent"
				role="status"
				aria-label="Loading board"
			></div>
		{/if}
	</div>
{:else}
	{@const icon = { notfound: FileQuestion, trashed: Trash2, error: TriangleAlert }[status.kind]}
	{@const Icon = icon}
	<main class="flex h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
		<div class="mb-2 flex size-14 items-center justify-center rounded-2xl bg-surface-2 text-muted">
			<Icon class="size-7" aria-hidden="true" />
		</div>
		<h1 class="text-lg font-medium">
			{#if status.kind === 'notfound'}Board not found
			{:else if status.kind === 'trashed'}This board is in the trash
			{:else}Couldn’t open this board{/if}
		</h1>
		<p class="max-w-sm text-sm text-muted">
			{#if status.kind === 'notfound'}It may have been deleted, or the link is wrong.
			{:else if status.kind === 'trashed'}Restore it to keep working on it.
			{:else}{status.message}{/if}
		</p>
		<div class="mt-2 flex gap-2">
			{#if status.kind === 'trashed'}
				<button
					type="button"
					class="{button} bg-accent text-accent-contrast hover:opacity-90"
					onclick={restoreAndOpen}
				>
					Restore
				</button>
			{/if}
			<a href={resolve('/')} class="{button} bg-surface-2 hover:bg-border">Back to boards</a>
		</div>
	</main>
{/if}
