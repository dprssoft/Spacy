<script lang="ts">
	import { untrack } from 'svelte';
	import { fontStack } from '$lib/fonts/catalog';
	import { FONT_SIZE_PX } from '$lib/model/defaults';
	import { getDocsMap } from '$lib/model/doc';
	import { updateElement } from '$lib/model/ops';
	import { LAYOUT } from '$lib/model/origins';
	import type { TableElement } from '$lib/model/types';
	import { getBoard } from '../../context';
	import { activeDocEditor } from '../../doccards/activeEditor.svelte';
	import BubbleMenu from '../../doccards/BubbleMenu.svelte';
	import type { Editor } from '../../doccards/editorFactory';
	import { loadBoardEditor, type BoardEditorModule } from '../../doccards/lazy';
	import '../../doccards/prose.css';
	import { fillColor } from '../common';
	import type { ElementViewProps } from '../registry';

	let { el, editing }: ElementViewProps<TableElement> = $props();

	const ctx = getBoard();
	// The element's identity is fixed for this view's lifetime.
	// svelte-ignore state_referenced_locally
	const id = el.id;
	let body = $state<HTMLDivElement>();
	let menu = $state<HTMLDivElement>();
	let editor = $state.raw<Editor | null>(null);
	let editorModule = $state.raw<BoardEditorModule | null>(null);

	// Far zoomed out a light grid stands in for the editor (like doc cards).
	const LOW_ZOOM = 0.4;
	const wantEditor = $derived(editing || ctx.viewport.zoom >= LOW_ZOOM);
	const showEditor = $derived(wantEditor && editorModule !== null);
	$effect(() => {
		if (!wantEditor || editorModule) return;
		let alive = true;
		void loadBoardEditor()
			.then((m) => {
				if (alive) editorModule = m;
			})
			.catch((err: unknown) => console.error('Editor failed to load', err));
		return () => {
			alive = false;
		};
	});

	// The editor always shows the live shared content; it only becomes editable while editing.
	$effect(() => {
		if (!body || !menu || !editorModule) return;
		const fragment = getDocsMap(ctx.doc).get(id);
		if (!fragment) return;
		const node = body;
		const ed = editorModule.createBoardTableEditor({
			element: node,
			fragment,
			editable: false,
			bubbleMenu: menu,
			label: 'Table'
		});
		editor = ed;
		node.addEventListener('keydown', onkeydown);
		return () => {
			node.removeEventListener('keydown', onkeydown);
			editor = null;
			ed.destroy();
		};
	});

	$effect(() => {
		const ed = editor;
		if (!ed) return;
		const on = editing;
		untrack(() => {
			ed.setEditable(on);
			if (!on) {
				if (ed.view.hasFocus()) (ed.view.dom as HTMLElement).blur();
				const sel = getSelection();
				if (sel?.anchorNode && ed.view.dom.contains(sel.anchorNode)) sel.removeAllRanges();
				return;
			}
			const at = ctx.selection.editingAt;
			const pos = at ? ed.view.posAtCoords({ left: at.x, top: at.y }) : null;
			if (pos) ed.chain().setTextSelection(pos.pos).focus(null, { scrollIntoView: false }).run();
			else ed.commands.focus('start', { scrollIntoView: false });
		});
	});

	// The ribbon shows the formatting controls of the table being edited.
	$effect(() => {
		const ed = editor;
		if (!editing || !ed) return;
		activeDocEditor.current = ed;
		return () => {
			if (activeDocEditor.current === ed) activeDocEditor.current = null;
		};
	});

	// A pointerdown outside the table and its popups ends editing.
	$effect(() => {
		if (!editing) return;
		const onDown = (e: PointerEvent) => {
			const t = e.target;
			if (t instanceof Node && body?.contains(t)) return;
			if (t instanceof Element && t.closest('[data-doc-popup],[data-comment-popover]')) return;
			ctx.editing.end();
		};
		document.addEventListener('pointerdown', onDown, true);
		return () => document.removeEventListener('pointerdown', onDown, true);
	});

	/**
	 * The box's height follows the content. Only the tab that edits or has it selected writes it,
	 * so peers whose fonts measure differently don't fight over it. Derived, so not undoable.
	 */
	const owns = $derived(editing || ctx.selection.has(id));
	let contentH = $state(0);
	$effect(() => {
		const ed = editor;
		if (!ed) return;
		const dom = ed.view.dom as HTMLElement;
		const ro = new ResizeObserver(() => (contentH = Math.ceil(dom.offsetHeight)));
		ro.observe(dom);
		return () => ro.disconnect();
	});
	$effect(() => {
		const h = contentH;
		if (!owns || h <= 0 || Math.abs(h - el.h) < 1) return;
		const frame = requestAnimationFrame(() => {
			if (!el.locked) updateElement(ctx.doc, id, { h }, LAYOUT);
		});
		return () => cancelAnimationFrame(frame);
	});

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			ctx.editing.end();
		}
	}
</script>

<div
	class="absolute inset-0"
	style:background={fillColor(el.style)}
	style:color={el.style.font.color}
	style:font-size="{FONT_SIZE_PX[el.style.font.size]}px"
	style:--table-line={el.style.stroke}
	style:--table-line-w="{el.style.strokeWidth}px"
>
	{#if showEditor}
		<div
			bind:this={body}
			class="doc-prose table-element"
			class:pointer-events-auto={editing}
			data-interactive={editing ? '' : undefined}
			data-table-body
			style:font-family={fontStack(el.style.font.family)}
		></div>
	{:else}
		<div class="table-element-preview absolute inset-0" aria-hidden="true"></div>
	{/if}
</div>
{#if showEditor}
	<!-- The editor moves the menu into document.body while it's shown. -->
	<div class="hidden">
		<BubbleMenu {editor} bind:element={menu} />
	</div>
{/if}
