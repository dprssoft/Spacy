<script lang="ts">
	import FileQuestion from '@lucide/svelte/icons/file-question';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { resolve } from '$app/paths';
	import { NewerSchemaError } from '$lib/model/migrations';
	import { BoardNotFoundError, openBoard, type OpenBoard } from '$lib/storage/boardDoc';
	import * as boardsRepo from '$lib/storage/boardsRepo';
	import BoardWorkspace from './BoardWorkspace.svelte';

	let { id }: { id: string } = $props();

	type Status =
		| { kind: 'loading' }
		| { kind: 'ready'; board: OpenBoard }
		| { kind: 'notfound' }
		| { kind: 'trashed' }
		| { kind: 'error'; message: string };

	let status = $state<Status>({ kind: 'loading' });
	let showSpinner = $state(false);
	let destroyed = false;
	let opened: OpenBoard | null = null;

	async function load() {
		status = { kind: 'loading' };
		try {
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
					message: 'This board was created with a newer version of SMTHNG.'
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
			clearTimeout(timer);
			void opened?.close();
		};
	});

	const button =
		'inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none';
</script>

{#if status.kind === 'ready'}
	<BoardWorkspace board={status.board} />
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
