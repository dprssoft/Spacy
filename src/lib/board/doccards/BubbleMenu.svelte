<script lang="ts">
	import { untrack } from 'svelte';
	import Bold from '@lucide/svelte/icons/bold';
	import Code from '@lucide/svelte/icons/code';
	import Heading1 from '@lucide/svelte/icons/heading-1';
	import Heading2 from '@lucide/svelte/icons/heading-2';
	import Heading3 from '@lucide/svelte/icons/heading-3';
	import Italic from '@lucide/svelte/icons/italic';
	import Eye from '@lucide/svelte/icons/eye';
	import Link from '@lucide/svelte/icons/link';
	import MessageSquarePlus from '@lucide/svelte/icons/message-square-plus';
	import Strikethrough from '@lucide/svelte/icons/strikethrough';
	import type { Editor } from './editorFactory';
	import { canPreview, toggleLinkPreview } from './linkPreview';
	import LinkPopover from './LinkPopover.svelte';

	let {
		editor,
		element = $bindable(),
		oncomment
	}: {
		editor: Editor | null;
		element?: HTMLDivElement;
		/** Starts a comment on the selected text (board doc cards). */
		oncomment?: (editor: Editor) => void;
	} = $props();

	// Bumped on every editor transaction so the active states re-render.
	let tick = $state(0);
	let linking = $state(false);
	$effect(() => {
		const ed = editor;
		if (!ed) return;
		// Transactions are also dispatched from inside other components' effects (focusing the
		// editor): a tracked read of `tick` there would make that effect depend on it and loop.
		const bump = () => untrack(() => tick++);
		ed.on('transaction', bump);
		return () => {
			ed.off('transaction', bump);
		};
	});

	/** Reads an active state, re-run on every transaction. */
	function isOn(read: () => boolean): boolean {
		void tick;
		return read();
	}

	type Button = {
		label: string;
		icon: typeof Bold;
		active(ed: Editor): boolean;
		run(ed: Editor): void;
	};
	const marks: Button[] = [
		{
			label: 'Bold',
			icon: Bold,
			active: (ed) => ed.isActive('bold'),
			run: (ed) => ed.chain().focus().toggleBold().run()
		},
		{
			label: 'Italic',
			icon: Italic,
			active: (ed) => ed.isActive('italic'),
			run: (ed) => ed.chain().focus().toggleItalic().run()
		},
		{
			label: 'Strikethrough',
			icon: Strikethrough,
			active: (ed) => ed.isActive('strike'),
			run: (ed) => ed.chain().focus().toggleStrike().run()
		},
		{
			label: 'Code',
			icon: Code,
			active: (ed) => ed.isActive('code'),
			run: (ed) => ed.chain().focus().toggleCode().run()
		}
	];
	const headings: Button[] = ([1, 2, 3] as const).map((level, i) => ({
		label: `Heading ${level}`,
		icon: [Heading1, Heading2, Heading3][i]!,
		active: (ed) => ed.isActive('heading', { level }),
		run: (ed) => ed.chain().focus().toggleHeading({ level }).run()
	}));

	const button =
		'inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text aria-pressed:bg-accent/15 aria-pressed:text-accent';
</script>

{#snippet item(b: Button, ed: Editor)}
	{@const Icon = b.icon}
	<button
		type="button"
		class={button}
		aria-label={b.label}
		title={b.label}
		aria-pressed={isOn(() => b.active(ed))}
		onmousedown={(e) => e.preventDefault()}
		onclick={() => b.run(ed)}
	>
		<Icon class="size-4" aria-hidden="true" />
	</button>
{/snippet}

<div
	bind:this={element}
	role="toolbar"
	aria-label="Text formatting"
	data-interactive
	data-doc-popup
	class="fixed z-[70] flex w-max items-center gap-0.5 rounded-lg border border-border bg-surface p-1 shadow-lg"
>
	{#if editor}
		{#if linking}
			<LinkPopover {editor} onclose={() => (linking = false)} />
		{:else}
			{#each marks as b (b.label)}{@render item(b, editor)}{/each}
			<button
				type="button"
				class={button}
				aria-label="Link"
				title="Link"
				aria-pressed={isOn(() => editor!.isActive('link'))}
				onmousedown={(e) => e.preventDefault()}
				onclick={() => (linking = true)}
			>
				<Link class="size-4" aria-hidden="true" />
			</button>
			{#if isOn(() => canPreview(editor!.getAttributes('link').href))}
				<button
					type="button"
					class={button}
					aria-label="Page preview"
					title="Show the page under this link"
					aria-pressed={isOn(() => editor!.getAttributes('link').preview === true)}
					onmousedown={(e) => e.preventDefault()}
					onclick={() => toggleLinkPreview(editor!)}
				>
					<Eye class="size-4" aria-hidden="true" />
				</button>
			{/if}
			{#if oncomment}
				<button
					type="button"
					class={button}
					aria-label="Comment"
					title="Comment on the selection"
					data-bubble-comment
					onmousedown={(e) => e.preventDefault()}
					onclick={() => oncomment(editor!)}
				>
					<MessageSquarePlus class="size-4" aria-hidden="true" />
				</button>
			{/if}
			<div class="mx-0.5 h-5 w-px bg-border"></div>
			{#each headings as b (b.label)}{@render item(b, editor)}{/each}
		{/if}
	{/if}
</div>
