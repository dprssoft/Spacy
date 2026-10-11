<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import { updateElement } from '$lib/model/ops';
	import { setWidgetConfig } from '$lib/model/widgets';
	import { layout } from '$lib/shared/layout.svelte';
	import { getBoard } from '../context';
	import { worldToScreen } from '../engine/viewport';
	import { now } from './clock';
	import { widgetKind, widgetView } from './kinds';
	import { ticker } from './ticker.svelte';
	import { WIDGET_SETTINGS } from './ui';

	// A widget's settings, next to it (a bottom sheet on phones). Its buttons repeat the widget's
	// own, so everything works from the keyboard and with a screen reader.
	const ctx = getBoard();
	const { store, viewport, widgets } = ctx;
	const WIDTH = 280;

	const el = $derived.by(() => {
		const id = widgets.settingsId;
		const e = id ? store.get(id) : undefined;
		return e?.type === 'widget' ? e : null;
	});
	const def = $derived(el ? widgetKind(el.kind) : undefined);
	const Settings = $derived(el ? WIDGET_SETTINGS[el.kind] : undefined);
	const actions = $derived(el ? widgetView(el, (void ticker.now, now())).actions : []);

	// Gone (deleted, undone, another page): close.
	$effect(() => {
		if (widgets.settingsId && !el) widgets.closeSettings();
	});

	const position = $derived.by(() => {
		if (!el || layout.compact) return null;
		void viewport.vp;
		const canvas = document.querySelector('[data-testid="canvas"]')?.getBoundingClientRect();
		if (!canvas) return null;
		const p = worldToScreen(viewport.vp, { x: el.x + el.w, y: el.y });
		return {
			left: Math.max(8, Math.min(canvas.left + p.x + 16, window.innerWidth - WIDTH - 8)),
			top: Math.max(8, Math.min(canvas.top + p.y, window.innerHeight - 420))
		};
	});

	let root = $state<HTMLElement>();
	$effect(() => {
		if (!el) return;
		const onDown = (e: PointerEvent) => {
			if (e.target instanceof Node && root?.contains(e.target)) return;
			// Menus and selects opened from it live in portals.
			if (e.target instanceof Element && e.target.closest('[data-bits-floating-content]')) return;
			widgets.closeSettings();
		};
		window.addEventListener('pointerdown', onDown, true);
		return () => window.removeEventListener('pointerdown', onDown, true);
	});

	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape' || !el) return;
		e.preventDefault();
		e.stopPropagation();
		widgets.closeSettings();
		document.querySelector<HTMLElement>('[data-testid="canvas"]')?.focus();
	}

	function setConfig(config: unknown) {
		if (!el || el.locked) return;
		ctx.undo.stopCapturing();
		setWidgetConfig(ctx.doc, el.id, config);
		ctx.undo.stopCapturing();
	}

	const button =
		'h-8 rounded-md border border-border px-2.5 text-sm hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none';
</script>

<svelte:window onkeydowncapture={onWindowKeydown} />

{#if el && def && (position || layout.compact)}
	<div
		bind:this={root}
		role="dialog"
		aria-label="{def.label} settings"
		tabindex="-1"
		data-interactive
		data-testid="widget-settings"
		class="fixed z-40 flex flex-col gap-3 border border-border bg-surface p-3 shadow-lg {layout.compact
			? 'inset-x-0 bottom-0 rounded-t-xl pb-[max(0.75rem,env(safe-area-inset-bottom))]'
			: 'rounded-lg'}"
		style:left={position ? `${position.left}px` : undefined}
		style:top={position ? `${position.top}px` : undefined}
		style:width={position ? `${WIDTH}px` : undefined}
	>
		<div class="flex items-center justify-between">
			<h2 class="text-sm font-semibold">{def.label}</h2>
			<button
				type="button"
				class="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
				aria-label="Close"
				onclick={() => widgets.closeSettings()}><X class="size-4" aria-hidden="true" /></button
			>
		</div>
		{#if actions.length > 0}
			<div class="flex flex-wrap gap-1.5" role="group" aria-label="Controls">
				{#each actions as a (a.id)}
					<button
						type="button"
						class="{button} {a.primary
							? 'border-accent bg-accent text-white hover:bg-accent/90'
							: ''}"
						data-action={a.id}
						onclick={() => widgets.run(el.id, a.id)}>{a.label}</button
					>
				{/each}
			</div>
		{/if}
		<label class="flex flex-col gap-1 text-xs font-medium text-muted">
			Title
			<input
				class="h-8 rounded-md border border-border bg-bg px-2 text-sm text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-50"
				value={el.title}
				maxlength="100"
				placeholder={def.label}
				disabled={el.locked}
				oninput={(e) => updateElement(ctx.doc, el.id, { title: e.currentTarget.value })}
			/>
		</label>
		{#if Settings}
			<Settings {el} {setConfig} disabled={el.locked} />
		{/if}
	</div>
{/if}
