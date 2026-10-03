<script lang="ts">
	import { Popover } from 'bits-ui';
	import Check from '@lucide/svelte/icons/check';
	import ColorSwatches from '../style/controls/ColorSwatches.svelte';
	import { OPAQUE_SWATCHES } from '../style/palette';
	import { button } from '../ui/ribbon';
	import type { Editor } from './editorFactory';
	import { setChoice } from './formatCommands';
	import { isHexColor } from './formatOptions';

	// Text color or highlight of the doc card being edited: the board's palette or any color.
	let {
		editor,
		mark,
		name,
		none,
		current,
		icon: Icon
	}: {
		editor: Editor;
		mark: 'textColor' | 'highlight';
		name: string;
		/** The entry that removes the color. */
		none: string;
		/** The selection's color: a palette id of older content, a `#rrggbb` value, or null. */
		current: string | null;
		icon: typeof Check;
	} = $props();

	let open = $state(false);
	const css = $derived(current ? (isHexColor(current) ? current : `var(--doc-${current})`) : null);

	function pick(color: string | null) {
		setChoice(editor, mark, color);
		open = false;
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger
		class="{button} doc-format"
		aria-label="{name}: {current ?? none}"
		title={name}
		data-doc-format={mark}
	>
		<Icon class="size-[18px]" aria-hidden="true" />
		<span
			class="absolute inset-x-1.5 bottom-1 h-1 rounded-full"
			style:background={css ?? 'transparent'}
			aria-hidden="true"
		></span>
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content
			align="start"
			sideOffset={4}
			collisionPadding={8}
			class="doc-format z-[70] flex flex-col gap-2 rounded-lg border border-border bg-surface p-2 text-text shadow-lg outline-none"
			data-interactive
			data-doc-popup
			onCloseAutoFocus={(e) => {
				// Back to the text, with its selection (not `commands.focus()`: that waits a frame).
				e.preventDefault();
				editor.view.focus();
			}}
		>
			<button
				type="button"
				class="flex h-8 items-center gap-2 rounded-md px-2 text-sm hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
				onclick={() => pick(null)}
			>
				<span class="w-4 shrink-0">
					{#if current === null}<Check class="size-4" aria-hidden="true" />{/if}
				</span>
				{none}
			</button>
			<ColorSwatches value={current ?? ''} colors={OPAQUE_SWATCHES} label={name} onchange={pick} />
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
