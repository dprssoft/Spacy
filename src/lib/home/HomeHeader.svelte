<script lang="ts">
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
		'inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';
</script>

<svelte:window onkeydown={onWindowKeydown} />

<header class="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-surface px-4">
	<div class="flex shrink-0 items-center gap-2 md:w-52">
		<Logo class="size-7" />
		<h1 class="text-[15px] font-semibold tracking-tight">SMTHNG</h1>
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

	<div class="ml-auto flex items-center gap-1">
		<ImportButton class={iconButton} />
		<ThemeToggle />
		<SettingsMenu class={iconButton} />
	</div>
</header>
