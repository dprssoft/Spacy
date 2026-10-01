<script lang="ts">
	import { untrack } from 'svelte';
	import { FONT_SIZE_PX } from '$lib/model/defaults';
	import { getDocsMap } from '$lib/model/doc';
	import type { DocCardElement, Point } from '$lib/model/types';
	import { getBoard } from '../../context';
	import { createBoardDocEditor, mentionAt, refreshMentions } from '../../doccards/boardEditor';
	import BubbleMenu from '../../doccards/BubbleMenu.svelte';
	import type { Editor } from '../../doccards/editorFactory';
	import { openFocus } from '../../doccards/focus';
	import { jumpToElement } from '../../doccards/jumpTo';
	import { isSuggestionKey } from '../../doccards/suggestionPopup.svelte';
	import '../../doccards/prose.css';
	import { fillColor, radiusPx } from '../common';
	import type { ElementViewProps } from '../registry';
	import DocCardHeader from './DocCardHeader.svelte';

	let { el, editing }: ElementViewProps<DocCardElement> = $props();

	const ctx = getBoard();
	// The element's identity is fixed for this view's lifetime.
	// svelte-ignore state_referenced_locally
	const id = el.id;
	let card = $state<HTMLDivElement>();
	let body = $state<HTMLDivElement>();
	let menu = $state<HTMLDivElement>();
	let editor = $state.raw<Editor | null>(null);

	function contains(selector: string, at: Point): boolean {
		const r = card?.querySelector(selector)?.getBoundingClientRect();
		return !!r && at.x >= r.left && at.x <= r.right && at.y >= r.top && at.y <= r.bottom;
	}

	/**
	 * What editing targets: double-click on the title renames, elsewhere on the header opens focus
	 * mode, on the body edits it. Without a pointer (Enter): the body, or the title when collapsed.
	 */
	const part = $derived.by((): 'title' | 'body' | 'focus' | null => {
		if (!editing) return null;
		const at = ctx.selection.editingAt;
		if (!at) return el.collapsed ? 'title' : 'body';
		if (contains('[data-doccard-title]', at)) return 'title';
		if (el.collapsed || contains('[data-doccard-header]', at)) return 'focus';
		return 'body';
	});

	$effect(() => {
		if (part !== 'focus') return;
		untrack(() => {
			ctx.editing.end();
			openFocus(ctx.id, id);
		});
	});

	// The editor always renders the live shared content; it only becomes editable while editing.
	$effect(() => {
		if (!body || !menu) return;
		const fragment = getDocsMap(ctx.doc).get(id);
		if (!fragment) return;
		const node = body;
		const ed = createBoardDocEditor(ctx, {
			element: node,
			fragment,
			editable: false,
			bubbleMenu: menu
		});
		editor = ed;
		// The editor itself is the interactive element (role textbox); listen on its container.
		node.addEventListener('keydown', onkeydown);
		node.addEventListener('wheel', onwheel);
		node.addEventListener('click', onclick);
		return () => {
			node.removeEventListener('keydown', onkeydown);
			node.removeEventListener('wheel', onwheel);
			node.removeEventListener('click', onclick);
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

	// Mention chips of deleted objects are struck through.
	$effect(() => {
		void ctx.store.elements.size;
		if (editor) untrack(() => refreshMentions(editor!));
	});

	// A pointerdown outside the card body and its popups ends body editing.
	$effect(() => {
		if (part !== 'body') return;
		const onDown = (e: PointerEvent) => {
			const t = e.target;
			if (t instanceof Node && body?.contains(t)) return;
			if (t instanceof Element && t.closest('[data-doc-popup]')) return;
			ctx.editing.end();
		};
		document.addEventListener('pointerdown', onDown, true);
		return () => document.removeEventListener('pointerdown', onDown, true);
	});

	function onkeydown(e: KeyboardEvent) {
		if (isSuggestionKey(e)) return; // e.g. Escape closing a slash/mention popup
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			ctx.editing.end();
		} else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			ctx.editing.end();
			openFocus(ctx.id, id);
		}
	}

	function onclick(e: MouseEvent) {
		const target = mentionAt(e.target);
		if (target) jumpToElement(ctx, target);
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
	bind:this={card}
	class="absolute inset-0 flex flex-col overflow-hidden"
	style:background={fillColor(el.style)}
	style:border="{el.style.strokeWidth}px solid {el.style.stroke}"
	style:border-radius="{radiusPx(el.style)}px"
	style:color={el.style.font.color}
	style:font-size="{FONT_SIZE_PX[el.style.font.size]}px"
>
	<DocCardHeader
		{el}
		editingTitle={part === 'title'}
		onopen={() => {
			ctx.editing.end();
			openFocus(ctx.id, id);
		}}
	/>
	<div
		bind:this={body}
		class="doc-prose min-h-0 flex-1 overflow-y-auto px-4 py-3"
		class:hidden={el.collapsed}
		class:pointer-events-auto={part === 'body'}
		data-interactive={part === 'body' ? '' : undefined}
		data-doccard-body
	></div>
</div>
<!-- The editor moves the menu into document.body while it's shown. -->
<div class="hidden"><BubbleMenu {editor} bind:element={menu} /></div>
