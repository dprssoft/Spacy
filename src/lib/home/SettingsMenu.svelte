<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import Settings from '@lucide/svelte/icons/settings';
	import { toast } from 'svelte-sonner';
	import { pwa } from '$lib/shared/pwa.svelte';
	import { theme, type ThemeMode } from '$lib/shared/theme.svelte';
	import { isPaletteId, PALETTES } from '$lib/shared/palettes';
	import { requestPersistentStorage, storageEstimate } from '$lib/storage/persist';
	import AboutDialog from './AboutDialog.svelte';
	import CommentNameDialog from './CommentNameDialog.svelte';
	import { backupAll, importFiles } from './fileActions';
	import { formatBytes } from './formatBytes';
	import { LINK_PREVIEW_PREF } from '$lib/board/doccards/links';
	import { readMediaPrefs, writeMediaPrefs } from '$lib/board/media/mediaPrefs';
	import { getPref, setPref } from '$lib/shared/localPrefs';
	import { fullscreen } from '$lib/shared/fullscreen.svelte';
	import { driveSync } from '$lib/sync/driveSync.svelte';
	import SyncDialog from '$lib/sync/SyncDialog.svelte';

	let { class: className = '' }: { class?: string } = $props();

	let open = $state(false);
	let oneAtATime = $state(readMediaPrefs().oneAtATime);
	let linkPreview = $state(getPref<unknown>(LINK_PREVIEW_PREF, false) === true);
	let about = $state(false);
	let commentName = $state(false);
	let sync = $state(false);
	let input = $state<HTMLInputElement>();
	let storage = $state<{ usage: number; persisted: boolean } | null>(null);

	const refreshStorage = () => void storageEstimate().then((s) => (storage = s));
	$effect(() => {
		if (open) refreshStorage();
	});

	async function persist() {
		const ok = await requestPersistentStorage(true);
		toast(ok ? 'Storage is now persistent' : 'The browser didn’t grant persistent storage');
		refreshStorage();
	}

	const MODES: { value: ThemeMode; label: string }[] = [
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' },
		{ value: 'system', label: 'System' }
	];
	const item =
		'flex h-8 cursor-default items-center gap-2 rounded-md px-2 text-sm outline-none select-none data-[highlighted]:bg-surface-2';
	const heading = 'px-2 pt-1.5 pb-0.5 text-xs font-medium text-muted';
	const sep = 'my-1 h-px bg-border';
</script>

<DropdownMenu.Root bind:open>
	<DropdownMenu.Trigger class={className} aria-label="Settings" title="Settings">
		<Settings class="size-[18px]" aria-hidden="true" />
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content
			align="end"
			sideOffset={4}
			class="z-50 max-h-[var(--bits-dropdown-menu-content-available-height)] min-w-72 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg"
		>
			<DropdownMenu.RadioGroup value={theme.mode} onValueChange={(v) => theme.set(v as ThemeMode)}>
				<DropdownMenu.GroupHeading class={heading}>Theme</DropdownMenu.GroupHeading>
				{#each MODES as m (m.value)}
					<DropdownMenu.RadioItem value={m.value} class={item} closeOnSelect={false}>
						{#snippet children({ checked })}
							<span class="w-4 text-accent" aria-hidden="true">{checked ? '●' : ''}</span>{m.label}
						{/snippet}
					</DropdownMenu.RadioItem>
				{/each}
			</DropdownMenu.RadioGroup>
			<DropdownMenu.Separator class={sep} />
			<DropdownMenu.RadioGroup
				value={theme.palette}
				onValueChange={(v) => isPaletteId(v) && theme.setPalette(v)}
				class="grid grid-cols-2"
			>
				<DropdownMenu.GroupHeading class="col-span-2 {heading}">Palette</DropdownMenu.GroupHeading>
				{#each PALETTES as p (p.id)}
					<DropdownMenu.RadioItem
						value={p.id}
						class={item}
						closeOnSelect={false}
						data-palette-option={p.id}
					>
						{#snippet children({ checked })}
							<span class="w-4 text-accent" aria-hidden="true">{checked ? '●' : ''}</span>
							<span
								class="size-3.5 rounded-full border border-black/10"
								style:background={p.accent[theme.resolved]}
								aria-hidden="true"
							></span>{p.label}
						{/snippet}
					</DropdownMenu.RadioItem>
				{/each}
			</DropdownMenu.RadioGroup>
			<DropdownMenu.Separator class={sep} />
			<DropdownMenu.CheckboxItem
				class={item}
				closeOnSelect={false}
				checked={theme.glass}
				onCheckedChange={(v) => theme.setGlass(v)}
			>
				{#snippet children({ checked })}
					<span class="w-4 text-accent" aria-hidden="true">{checked ? '✓' : ''}</span>Liquid glass
				{/snippet}
			</DropdownMenu.CheckboxItem>
			<DropdownMenu.CheckboxItem
				class={item}
				closeOnSelect={false}
				bind:checked={linkPreview}
				onCheckedChange={(v) => setPref(LINK_PREVIEW_PREF, v)}
			>
				{#snippet children({ checked })}
					<span class="w-4 text-accent" aria-hidden="true">{checked ? '✓' : ''}</span>Preview links
					on hover
				{/snippet}
			</DropdownMenu.CheckboxItem>
			<DropdownMenu.CheckboxItem
				class={item}
				closeOnSelect={false}
				bind:checked={oneAtATime}
				onCheckedChange={(v) => writeMediaPrefs({ oneAtATime: v })}
			>
				{#snippet children({ checked })}
					<span class="w-4 text-accent" aria-hidden="true">{checked ? '✓' : ''}</span>Play one media
					at a time
				{/snippet}
			</DropdownMenu.CheckboxItem>
			<DropdownMenu.Item class={item} onSelect={() => (commentName = true)}
				>Your name for comments…</DropdownMenu.Item
			>
			<DropdownMenu.Separator class={sep} />
			{#if pwa.canInstall}
				<DropdownMenu.Item class={item} onSelect={() => pwa.install()}
					>Install app</DropdownMenu.Item
				>
			{/if}
			{#if fullscreen.supported}
				<DropdownMenu.Item class={item} onSelect={() => fullscreen.toggle()}
					>{fullscreen.active ? 'Exit full screen' : 'Full screen'}</DropdownMenu.Item
				>
			{/if}
			{#if driveSync.available}
				<DropdownMenu.Item class={item} onSelect={() => (sync = true)}
					>{driveSync.connected
						? 'Google Drive sync…'
						: 'Sync with Google Drive…'}</DropdownMenu.Item
				>
			{/if}
			<DropdownMenu.Item class={item} onSelect={() => backupAll()}
				>Backup all boards</DropdownMenu.Item
			>
			<DropdownMenu.Item class={item} onSelect={() => input?.click()}
				>Restore from backup…</DropdownMenu.Item
			>
			<DropdownMenu.Separator class={sep} />
			<p class="px-2 py-1.5 text-xs text-muted" data-testid="storage-info">
				{#if storage}
					Using {formatBytes(storage.usage)} · Persistent: {storage.persisted ? 'yes' : 'no'}
				{:else}
					Storage: unknown
				{/if}
			</p>
			{#if storage && !storage.persisted}
				<DropdownMenu.Item class={item} closeOnSelect={false} onSelect={persist}
					>Request persistent storage</DropdownMenu.Item
				>
			{/if}
			<DropdownMenu.Separator class={sep} />
			<DropdownMenu.Item class={item} onSelect={() => (about = true)}>About Spacy</DropdownMenu.Item
			>
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>

<input
	bind:this={input}
	type="file"
	accept=".spacy,.smthng,application/json"
	multiple
	hidden
	onchange={async (e) => {
		const files = [...(e.currentTarget.files ?? [])];
		e.currentTarget.value = '';
		await importFiles(files);
	}}
/>
<AboutDialog bind:open={about} />
<CommentNameDialog bind:open={commentName} />
{#if driveSync.available}
	<SyncDialog bind:open={sync} />
{/if}
