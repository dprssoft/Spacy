<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import Upload from '@lucide/svelte/icons/upload';
	import Settings from '@lucide/svelte/icons/settings';
	import Logo from '$lib/shared/ui/Logo.svelte';
	import ThemeToggle from '$lib/shared/ui/ThemeToggle.svelte';

	const iconButton =
		'inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';
</script>

<header class="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-surface px-4">
	<div class="flex w-52 shrink-0 items-center gap-2">
		<Logo class="size-7" />
		<h1 class="text-[15px] font-semibold tracking-tight">SMTHNG</h1>
	</div>

	<!-- Wired up in step 07. -->
	<label class="relative hidden max-w-md flex-1 sm:block">
		<span class="sr-only">Search boards</span>
		<Search
			class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
			aria-hidden="true"
		/>
		<input
			type="search"
			placeholder="Search boards…"
			disabled
			class="h-9 w-full rounded-lg border border-border bg-bg pr-3 pl-9 text-sm placeholder:text-muted disabled:opacity-60"
		/>
	</label>

	<div class="ml-auto flex items-center gap-1">
		<button
			type="button"
			class={iconButton}
			aria-label="Import boards"
			title="Coming soon"
			disabled
		>
			<Upload class="size-[18px]" aria-hidden="true" />
		</button>
		<ThemeToggle />
		<button type="button" class={iconButton} aria-label="Settings" title="Coming soon" disabled>
			<Settings class="size-[18px]" aria-hidden="true" />
		</button>
	</div>
</header>
