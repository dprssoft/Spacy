<script lang="ts">
	import { untrack } from 'svelte';
	import { FONT_SIZE_PX } from '$lib/model/defaults';
	import { getDocsMap } from '$lib/model/doc';
	import type { DocCardElement } from '$lib/model/types';
	import { getBoard } from '../../context';
	import { createDocEditor, type Editor } from '../../doccards/editorFactory';
	import '../../doccards/prose.css';
	import { fillColor, radiusPx } from '../common';
	import type { ElementViewProps } from '../registry';
	import DocCardHeader from './DocCardHeader.svelte';

	let { el, editing }: ElementViewProps<DocCardElement> = $props();

	const ctx = getBoard();
	// The element's identity is fixed for this view's lifetime.
	// svelte-ignore state_referenced_locally
	const id = el.id;
	let body = $state<HTMLDivElement>();
	let editor = $state.raw<Editor | null>(null);

	/** What is being edited: the title (double-click on the header, or a collapsed card) or the body. */
	const part = $derived.by((): 'title' | 'body' | null => {
		if (!editing) return null;
		if (el.collapsed) return 'title';
		const at = ctx.selection.editingAt;
		if (at && body && at.y < body.getBoundingClientRect().top) return 'title';
		return 'body';
	});

	// The editor always renders the live shared content; it only becomes editable while editing.
	$effect(() => {
		if (!body) return;
		const fragment = getDocsMap(ctx.doc).get(id);
		if (!fragment) return;
		const node = body;
		const ed = createDocEditor({ element: node, fragment, editable: false });
		editor = ed;
		// The editor itself is the interactive element (role textbox); listen on its container.
		node.addEventListener('keydown', onkeydown);
		node.addEventListener('wheel', onwheel);
		return () => {
			node.removeEventListener('keydown', onkeydown);
			node.removeEventListener('wheel', onwheel);
			editor = null;
			ed.destroy();
		};
	});

	$effect(() => {
		const ed = editor;
		if (!ed) return;
		const on = part === 'body';
		ed.setEditable(on);
		if (!on) {
			if (ed.view.hasFocus()) (ed.view.dom as HTMLElement).blur();
			return;
		}
		const at = untrack(() => ctx.selection.editingAt);
		const pos = at ? ed.view.posAtCoords({ left: at.x, top: at.y }) : null;
		if (pos) ed.chain().setTextSelection(pos.pos).focus(null, { scrollIntoView: false }).run();
		else ed.commands.focus('end', { scrollIntoView: false });
	});

	// A pointerdown anywhere outside the card ends body editing (the canvas tool then handles it).
	$effect(() => {
		if (part !== 'body') return;
		const onDown = (e: PointerEvent) => {
			if (body && e.target instanceof Node && body.contains(e.target)) return;
			ctx.editing.end();
		};
		document.addEventListener('pointerdown', onDown, true);
		return () => document.removeEventListener('pointerdown', onDown, true);
	});

	function onkeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		e.preventDefault();
		e.stopPropagation();
		ctx.editing.end();
	}

	/** Scroll the body when it can scroll that way; otherwise let the canvas pan. */
	function onwheel(e: WheelEvent) {
		if (part !== 'body' || !body || e.ctrlKey || e.metaKey) return;
		const down = e.deltaY > 0;
		const canScroll = down
			? body.scrollTop + body.clientHeight < body.scrollHeight - 1
			: body.scrollTop > 0;
		if (e.deltaY !== 0 && canScroll) e.stopPropagation();
	}
</script>

<div
	class="absolute inset-0 flex flex-col overflow-hidden"
	style:background={fillColor(el.style)}
	style:border="{el.style.strokeWidth}px solid {el.style.stroke}"
	style:border-radius="{radiusPx(el.style)}px"
	style:color={el.style.font.color}
	style:font-size="{FONT_SIZE_PX[el.style.font.size]}px"
>
	<DocCardHeader {el} editingTitle={part === 'title'} />
	<div
		bind:this={body}
		class="doc-prose min-h-0 flex-1 overflow-y-auto px-4 py-3"
		class:hidden={el.collapsed}
		class:pointer-events-auto={part === 'body'}
		data-interactive={part === 'body' ? '' : undefined}
		data-doccard-body
	></div>
</div>
