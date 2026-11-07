<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { untrack } from 'svelte';
	import Baseline from '@lucide/svelte/icons/baseline';
	import Bold from '@lucide/svelte/icons/bold';
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Highlighter from '@lucide/svelte/icons/highlighter';
	import Italic from '@lucide/svelte/icons/italic';
	import List from '@lucide/svelte/icons/list';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import ListOrdered from '@lucide/svelte/icons/list-ordered';
	import RemoveFormatting from '@lucide/svelte/icons/remove-formatting';
	import Strikethrough from '@lucide/svelte/icons/strikethrough';
	import TextAlignCenter from '@lucide/svelte/icons/text-align-center';
	import TextAlignEnd from '@lucide/svelte/icons/text-align-end';
	import TextAlignJustify from '@lucide/svelte/icons/text-align-justify';
	import TextAlignStart from '@lucide/svelte/icons/text-align-start';
	import Underline from '@lucide/svelte/icons/underline';
	import { button, caption, groupBox } from '../ui/ribbon';
	import DocColorPicker from './DocColorPicker.svelte';
	import type { Editor } from './editorFactory';
	import TableMenu from './TableMenu.svelte';
	import * as fmt from './formatCommands';
	import {
		BLOCK_STYLES,
		FONTS,
		SIZES,
		type Align,
		type FormatChoice,
		type FormatMark
	} from './formatOptions';
	import './prose.css';

	// Word-like formatting groups for the doc card being edited (in the ribbon, and in focus mode).
	let { editor }: { editor: Editor } = $props();

	// A table element's editor has no headings, lists or quotes, and is always one table.
	const tableOnly = $derived(!editor.schema.nodes.heading);

	// Bumped on every transaction so the controls show the formatting at the caret.
	let tick = $state(0);
	$effect(() => {
		const ed = editor;
		// Untracked: transactions are also dispatched from inside other components' effects.
		const bump = () => untrack(() => tick++);
		ed.on('transaction', bump);
		return () => {
			ed.off('transaction', bump);
		};
	});

	const at = $derived.by(() => {
		void tick;
		return {
			block: fmt.blockStyleOf(editor),
			font: fmt.choiceOf(editor, 'fontFamily'),
			size: fmt.choiceOf(editor, 'fontSize'),
			color: fmt.choiceOf(editor, 'textColor'),
			highlight: fmt.choiceOf(editor, 'highlight'),
			align: fmt.alignOf(editor),
			bold: editor.isActive('bold'),
			italic: editor.isActive('italic'),
			underline: editor.isActive('underline'),
			strike: editor.isActive('strike'),
			bullet: editor.isActive('bulletList'),
			ordered: editor.isActive('orderedList'),
			task: editor.isActive('taskList'),
			table: editor.isActive('table')
		};
	});

	type Toggle = { label: string; icon: typeof Bold; on: boolean; run(): void };
	const chain = () => editor.chain().focus();
	const marks = $derived<Toggle[]>([
		{ label: 'Bold', icon: Bold, on: at.bold, run: () => chain().toggleBold().run() },
		{ label: 'Italic', icon: Italic, on: at.italic, run: () => chain().toggleItalic().run() },
		{
			label: 'Underline',
			icon: Underline,
			on: at.underline,
			run: () => chain().toggleUnderline().run()
		},
		{
			label: 'Strikethrough',
			icon: Strikethrough,
			on: at.strike,
			run: () => chain().toggleStrike().run()
		}
	]);
	const lists = $derived<Toggle[]>([
		{
			label: 'Bullet list',
			icon: List,
			on: at.bullet,
			run: () => chain().toggleBulletList().run()
		},
		{
			label: 'Numbered list',
			icon: ListOrdered,
			on: at.ordered,
			run: () => chain().toggleOrderedList().run()
		},
		{ label: 'Checklist', icon: ListChecks, on: at.task, run: () => chain().toggleTaskList().run() }
	]);
	const aligns: { id: Align; label: string; icon: typeof Bold }[] = [
		{ id: 'left', label: 'Align left', icon: TextAlignStart },
		{ id: 'center', label: 'Align center', icon: TextAlignCenter },
		{ id: 'right', label: 'Align right', icon: TextAlignEnd },
		{ id: 'justify', label: 'Justify', icon: TextAlignJustify }
	];

	const labelOf = (choices: readonly FormatChoice[], id: string | null, fallback: string) =>
		choices.find((c) => c.id === id)?.label ?? fallback;

	/** Menus take the focus while open: give it back to the text, with its selection. */
	function refocus(e: Event) {
		e.preventDefault();
		// Not `commands.focus()`: that waits for a frame, and a key pressed before it is lost.
		editor.view.focus();
	}

	const select =
		'inline-flex h-8 items-center justify-between gap-1 rounded-md border border-border px-2 text-xs text-text hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none';
	const menu =
		'doc-format z-[70] rounded-lg border border-border bg-surface p-1 text-text shadow-lg outline-none';
	const menuItem =
		'flex h-8 cursor-default items-center gap-2 rounded-md px-2 text-sm outline-none select-none data-[highlighted]:bg-surface-2';
</script>

{#snippet toggle(t: Toggle)}
	{@const Icon = t.icon}
	<button
		type="button"
		class={button}
		aria-label={t.label}
		title={t.label}
		aria-pressed={t.on}
		onmousedown={(e) => e.preventDefault()}
		onclick={t.run}
	>
		<Icon class="size-[18px]" aria-hidden="true" />
	</button>
{/snippet}

{#snippet choiceMenu(
	name: string,
	mark: FormatMark,
	choices: readonly FormatChoice[],
	current: string | null,
	fallback: string,
	width: string
)}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger
			class="{select} {width} doc-format"
			aria-label="{name}: {labelOf(choices, current, fallback)}"
			title={name}
			data-doc-format={mark}
		>
			<span class="truncate" data-font={mark === 'fontFamily' ? current : undefined}
				>{labelOf(choices, current, fallback)}</span
			>
			<ChevronDown class="size-3 shrink-0 opacity-60" aria-hidden="true" />
		</DropdownMenu.Trigger>
		<DropdownMenu.Portal>
			<DropdownMenu.Content
				align="start"
				sideOffset={4}
				class="{menu} max-h-(--bits-floating-available-height) min-w-40 overflow-y-auto"
				data-interactive
				data-doc-popup
				onCloseAutoFocus={refocus}
			>
				{#each [{ id: null, label: fallback }, ...choices] as c (c.id)}
					<DropdownMenu.Item class={menuItem} onSelect={() => fmt.setChoice(editor, mark, c.id)}>
						<span class="w-4 shrink-0">
							{#if c.id === current}<Check class="size-4" aria-hidden="true" />{/if}
						</span>
						<span data-font={mark === 'fontFamily' ? c.id : undefined}>{c.label}</span>
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Portal>
	</DropdownMenu.Root>
{/snippet}

{#if !tableOnly}<div
		role="group"
		aria-label="Text style"
		class={groupBox}
		data-doc-popup
		data-doc-ribbon
	>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				class="{select} w-32"
				aria-label="Style: {labelOf(BLOCK_STYLES, at.block, 'Normal text')}"
				title="Style"
				data-doc-format="style"
			>
				<span class="truncate">{labelOf(BLOCK_STYLES, at.block, 'Normal text')}</span>
				<ChevronDown class="size-3 shrink-0 opacity-60" aria-hidden="true" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					align="start"
					sideOffset={4}
					class="{menu} min-w-44"
					data-interactive
					data-doc-popup
					onCloseAutoFocus={refocus}
				>
					{#each BLOCK_STYLES as s (s.id)}
						<DropdownMenu.Item class={menuItem} onSelect={() => fmt.setBlockStyle(editor, s.id)}>
							<span class="w-4 shrink-0">
								{#if s.id === at.block}<Check class="size-4" aria-hidden="true" />{/if}
							</span>
							{s.label}
						</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
		<span class={caption} aria-hidden="true">Style</span>
	</div>{/if}
<div role="group" aria-label="Font" class={groupBox} data-doc-popup>
	<div class="flex items-center gap-0.5">
		{@render choiceMenu('Font', 'fontFamily', FONTS, at.font, 'Default', 'w-36')}
		{@render choiceMenu('Size', 'fontSize', SIZES, at.size, 'Normal', 'w-20')}
		{#each marks as t (t.label)}{@render toggle(t)}{/each}
		<DocColorPicker
			{editor}
			mark="textColor"
			name="Text color"
			none="Default color"
			current={at.color}
			icon={Baseline}
		/>
		<DocColorPicker
			{editor}
			mark="highlight"
			name="Highlight"
			none="No highlight"
			current={at.highlight}
			icon={Highlighter}
		/>
		<button
			type="button"
			class={button}
			aria-label="Clear formatting"
			title="Clear formatting"
			onmousedown={(e) => e.preventDefault()}
			onclick={() => fmt.clearFormatting(editor)}
		>
			<RemoveFormatting class="size-[18px]" aria-hidden="true" />
		</button>
	</div>
	<span class={caption} aria-hidden="true">Font</span>
</div>
<div role="group" aria-label="Paragraph" class={groupBox} data-doc-popup>
	<div class="flex items-center gap-0.5">
		{#if !tableOnly}{#each lists as t (t.label)}{@render toggle(t)}{/each}{/if}
		<TableMenu {editor} inTable={at.table} canDelete={!tableOnly} {menu} {menuItem} {refocus} />
		<div class="mx-1 h-5 w-px bg-border" aria-hidden="true"></div>
		{#each aligns as a (a.id)}
			{@render toggle({
				label: a.label,
				icon: a.icon,
				on: at.align === a.id,
				run: () => fmt.setAlign(editor, a.id)
			})}
		{/each}
	</div>
	<span class={caption} aria-hidden="true">Paragraph</span>
</div>
