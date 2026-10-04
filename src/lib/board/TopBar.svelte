<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Download from '@lucide/svelte/icons/download';
	import Maximize from '@lucide/svelte/icons/maximize';
	import Minimize from '@lucide/svelte/icons/minimize';
	import Redo2 from '@lucide/svelte/icons/redo-2';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import { resolve } from '$app/paths';
	import { fullscreen } from '$lib/shared/fullscreen.svelte';
	import InlineEditable from '$lib/shared/ui/InlineEditable.svelte';
	import Logo from '$lib/shared/ui/Logo.svelte';
	import SettingsMenu from '$lib/home/SettingsMenu.svelte';
	import ThemeToggle from '$lib/shared/ui/ThemeToggle.svelte';
	import { getBoard } from './context';
	import SaveIndicator from './SaveIndicator.svelte';
	import { formatKeys } from './tools/formatKeys';
	import { exportDialog } from './ui/exportDialogState.svelte';
	import { compileDialog } from './writing/compileDialogState.svelte';
	import { canSaveToFile, downloadBoardFile, saveTarget } from './ui/saveToFile.svelte';
	import type { BoardTitle } from './title.svelte';

	let { title }: { title: BoardTitle } = $props();

	let editing = $state(false);
	const ctx = getBoard();
	const { history } = ctx;
	const iconButton =
		'inline-flex size-8 pointer-coarse:size-11 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-35 disabled:hover:bg-transparent';

	const item =
		'flex h-8 cursor-default items-center rounded-md px-2 text-sm outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-2';
</script>

<header
	class="flex h-[calc(2.75rem+env(safe-area-inset-top))] shrink-0 items-center gap-2 border-b border-border bg-surface-2 px-2 pt-[env(safe-area-inset-top)] max-sm:gap-0.5 max-sm:px-1"
>
	<a
		href={resolve('/')}
		aria-label="Back to boards"
		class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none pointer-coarse:size-11"
	>
		<Logo class="size-6" />
	</a>

	<div class="max-w-md min-w-0">
		{#if editing}
			<InlineEditable
				value={title.value}
				bind:editing
				ariaLabel="Board title"
				inputClass="text-sm font-medium"
				onCommit={(t) => title.rename(t)}
			/>
		{:else}
			<button
				type="button"
				onclick={() => (editing = true)}
				aria-label="Rename board: {title.value}"
				title="Rename"
				class="block max-w-full truncate rounded-md px-1.5 py-1 text-sm font-medium hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
			>
				{title.value}
			</button>
		{/if}
	</div>

	<div class="ml-2 flex shrink-0 items-center max-sm:ml-0">
		<button
			type="button"
			class={iconButton}
			aria-label="Undo"
			title="Undo ({formatKeys('Mod+Z')})"
			disabled={!history.canUndo}
			onclick={() => history.undo()}
		>
			<Undo2 class="size-4" aria-hidden="true" />
		</button>
		<button
			type="button"
			class={iconButton}
			aria-label="Redo"
			title="Redo ({formatKeys('Mod+Shift+Z')})"
			disabled={!history.canRedo}
			onclick={() => history.redo()}
		>
			<Redo2 class="size-4" aria-hidden="true" />
		</button>
	</div>

	<div class="ml-auto flex shrink-0 items-center gap-1 max-sm:gap-0">
		<SaveIndicator />
		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				class="inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none max-sm:px-2 pointer-coarse:h-11 pointer-coarse:min-w-11"
			>
				<Download class="size-4" aria-hidden="true" />
				<span class="max-sm:sr-only">Export</span>
				<ChevronDown class="size-3.5 text-muted max-sm:hidden" aria-hidden="true" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					align="end"
					sideOffset={4}
					class="z-50 min-w-48 rounded-lg border border-border bg-surface p-1 shadow-lg"
				>
					<DropdownMenu.Item class={item} onSelect={() => exportDialog.show('png')}
						>PNG…</DropdownMenu.Item
					>
					<DropdownMenu.Item class={item} onSelect={() => exportDialog.show('svg')}
						>SVG…</DropdownMenu.Item
					>
					<DropdownMenu.Item class={item} onSelect={() => (compileDialog.open = true)}
						>Compile manuscript…</DropdownMenu.Item
					>
					<DropdownMenu.Separator class="my-1 h-px bg-border" />
					<DropdownMenu.Item class={item} onSelect={() => downloadBoardFile(ctx.id, title.value)}
						>Download .smthng</DropdownMenu.Item
					>
					{#if canSaveToFile()}
						<DropdownMenu.Item class={item} onSelect={() => saveTarget.save(ctx.id, title.value)}
							>{saveTarget.label(ctx.id)}</DropdownMenu.Item
						>
					{/if}
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
		{#if fullscreen.supported}
			<!-- On phones it's in Settings (no room here). -->
			<button
				type="button"
				class="{iconButton} max-sm:hidden"
				aria-label={fullscreen.active ? 'Exit full screen' : 'Full screen'}
				aria-keyshortcuts="Shift+F"
				title="{fullscreen.active ? 'Exit full screen' : 'Full screen'} (Shift+F)"
				data-testid="fullscreen"
				onclick={() => fullscreen.toggle()}
			>
				{#if fullscreen.active}<Minimize class="size-4" aria-hidden="true" />{:else}<Maximize
						class="size-4"
						aria-hidden="true"
					/>{/if}
			</button>
		{/if}
		<!-- On phones the theme is in Settings. -->
		<div class="contents max-sm:hidden"><ThemeToggle /></div>
		<SettingsMenu
			class="inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none pointer-coarse:size-11"
		/>
	</div>
</header>
