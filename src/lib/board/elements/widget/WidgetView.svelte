<script lang="ts" module>
	import { MediaQuery } from 'svelte/reactivity';

	// Not in every environment (unit tests run without `matchMedia`).
	const reducedMotion =
		typeof matchMedia === 'function' ? new MediaQuery('prefers-reduced-motion: reduce') : null;
	// Bookkeeping across mounts, not reactive state.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const announced = new Set<string>();
</script>

<script lang="ts">
	import type { WidgetElement } from '$lib/model/types';
	import { getBoard } from '../../context';
	import { chime } from '../../widgets/chime';
	import { now } from '../../widgets/clock';
	import { widgetSvgDocument } from '../../widgets/face';
	import { readWidget, widgetView } from '../../widgets/kinds';
	import { ticker } from '../../widgets/ticker.svelte';
	import type { ElementViewProps } from '../registry';

	let { el }: ElementViewProps<WidgetElement> = $props();

	const ctx = getBoard();
	// The ticker drives redraws while it runs; the time itself is read fresh, so a change from a
	// peer (a timer just started) never draws with a stale clock.
	const t = $derived.by(() => {
		void ticker.now;
		void el;
		return now();
	});
	const motion = $derived(!reducedMotion?.current);
	const view = $derived(widgetView(el, t, motion));
	const hover = $derived(ctx.widgets.hover?.id === el.id ? ctx.widgets.hover.action : null);
	const markup = $derived(widgetSvgDocument(el, t, hover, motion));

	$effect(() => {
		if (view.ticking) return ticker.hold();
	});

	// Tabs that see a run end sound and announce it once (remounting doesn't repeat it).
	$effect(() => {
		const w = readWidget(el);
		const done = w?.def.finished?.(w.config, w.state, t);
		if (!done || announced.has(`${el.id}:${done.key}`)) return;
		announced.add(`${el.id}:${done.key}`);
		if (done.sound) chime();
		ctx.widgets.announce(done.message);
	});
</script>

<!-- The markup is built by widgets/face.ts with every text escaped. -->
<div
	class="absolute inset-0"
	class:alert={view.face.alert}
	data-widget={el.kind}
	{@attach (node) => {
		node.innerHTML = markup;
	}}
></div>

<style>
	.alert {
		animation: widget-pulse 0.5s ease-out 2;
	}
	@keyframes widget-pulse {
		50% {
			transform: scale(1.04);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.alert {
			animation: none;
		}
	}
</style>
