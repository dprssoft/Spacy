<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { DEFAULT_FONT, FONT_CATEGORIES, fontDef, pickableFonts } from '$lib/fonts/catalog';
	import { MIXED, type Mixed } from '../options';

	// The one font picker (text panel and doc card ribbon): a button showing the current font that
	// opens a single list of every font. The list is the only thing that scrolls, sized to the
	// room on screen, so every font can be reached however little room there is.
	let {
		value,
		onchange,
		triggerClass,
		triggerAttrs = {},
		contentAttrs = {},
		onCloseAutoFocus
	}: {
		/** A font id; null or undefined means the default font. */
		value: string | null | undefined | Mixed;
		onchange: (id: string) => void;
		triggerClass: string;
		/** Extra attributes for the button (data-* hooks). */
		triggerAttrs?: Record<string, string>;
		/** Extra attributes for the list (data-* hooks). */
		contentAttrs?: Record<string, string>;
		onCloseAutoFocus?: (e: Event) => void;
	} = $props();

	const current = $derived(value === MIXED ? null : (value ?? DEFAULT_FONT));
	const label = $derived(current === null ? 'Mixed' : fontDef(current).label);
	const fonts = $derived(pickableFonts(current));

	const item =
		'flex h-8 shrink-0 cursor-default items-center gap-2 rounded-md px-2 text-[15px] outline-none select-none data-[highlighted]:bg-surface-2';
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		{...triggerAttrs}
		class={triggerClass}
		aria-label="Font: {label}"
		title="Font"
	>
		<span class="truncate" style:font-family={current ? fontDef(current).stack : undefined}
			>{label}</span
		>
		<ChevronDown class="size-3 shrink-0 opacity-60" aria-hidden="true" />
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content
			{...contentAttrs}
			align="start"
			sideOffset={4}
			collisionPadding={8}
			{onCloseAutoFocus}
			data-testid="font-menu"
			class="z-[70] flex max-h-(--bits-floating-available-height) w-52 flex-col overflow-y-auto rounded-lg border border-border bg-surface p-1 text-text shadow-lg outline-none"
		>
			{#each FONT_CATEGORIES as category (category)}
				<DropdownMenu.Group>
					<DropdownMenu.GroupHeading class="px-2 pt-1.5 pb-0.5 text-[11px] text-muted">
						{category}
					</DropdownMenu.GroupHeading>
					<!-- Each name is shown in its own font. -->
					{#each fonts.filter((f) => f.category === category) as f (f.id)}
						<DropdownMenu.Item
							class={item}
							data-font-id={f.id}
							aria-checked={f.id === current}
							onSelect={() => onchange(f.id)}
						>
							<span class="w-4 shrink-0">
								{#if f.id === current}<Check class="size-4" aria-hidden="true" />{/if}
							</span>
							<span class="truncate" style:font-family={f.stack}>{f.label}</span>
						</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Group>
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
