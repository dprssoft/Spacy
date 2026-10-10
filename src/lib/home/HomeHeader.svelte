<script lang="ts">
	import SyncIndicator from '$lib/sync/SyncIndicator.svelte';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import Logo from '$lib/shared/ui/Logo.svelte';
	import ThemeToggle from '$lib/shared/ui/ThemeToggle.svelte';
	import ImportButton from './ImportButton.svelte';
	import SettingsMenu from './SettingsMenu.svelte';

	let { search = $bindable('') }: { search?: string } = $props();

	let input = $state<HTMLInputElement>();

	function isTyping(t: EventTarget | null): boolean {
		return (
			t instanceof HTMLElement &&
			(t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
		);
	}

	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) {
			e.preventDefault();
			input?.focus();
		}
	}

	const iconButton =
		'inline-flex size-9 pointer-coarse:size-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';
</script>

<svelte:window onkeydown={onWindowKeydown} />

<header
	class="flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-4 border-b border-border bg-surface px-4 pt-[env(safe-area-inset-top)] max-sm:gap-2 max-sm:px-2"
>
	<div class="flex shrink-0 items-center gap-2 md:w-52">
		<Logo class="size-7" />
		<h1 class="text-[15px] font-semibold tracking-tight max-sm:sr-only">Spacy</h1>
	</div>

	<div class="relative max-w-md min-w-0 flex-1">
		<Search
			class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
			aria-hidden="true"
		/>
		<input
			bind:this={input}
			bind:value={search}
			type="text"
			role="searchbox"
			aria-label="Search boards"
			placeholder="Search boards…"
			aria-keyshortcuts="/"
			onkeydown={(e) => {
				if (e.key === 'Escape') {
					search = '';
					input?.blur();
				}
			}}
			class="h-9 w-full rounded-lg border border-border bg-bg pr-8 pl-9 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
		/>
		{#if search}
			<button
				type="button"
				aria-label="Clear search"
				title="Clear search"
				onclick={() => {
					search = '';
					input?.focus();
				}}
				class="absolute top-1/2 right-1.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted hover:text-text"
			>
				<X class="size-3.5" aria-hidden="true" />
			</button>
		{/if}
	</div>

	<div class="ml-auto flex shrink-0 items-center gap-1 max-sm:gap-0">
		<ImportButton class={iconButton} />
		<!-- On phones the theme is in Settings. -->
		<div class="contents max-sm:hidden"><ThemeToggle /></div>
		<SyncIndicator />
		<SettingsMenu class={iconButton} />
	</div>
</header>
