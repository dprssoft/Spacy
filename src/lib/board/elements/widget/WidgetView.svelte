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
	import type * as Y from 'yjs';
	import { getDocsMap } from '$lib/model/doc';
	import type { WidgetElement } from '$lib/model/types';
	import { getBoard } from '../../context';
	import { fragmentToJSON } from '../../doccards/fragmentJson';
	import { countTasks } from '../../widgets/progress/checklist';
	import { chime } from '../../widgets/chime';
	import { now } from '../../widgets/clock';
	import { widgetSvgDocument } from '../../widgets/face';
	import { linkedCard, readWidget, widgetView, type WidgetEnv } from '../../widgets/kinds';
	import { ticker } from '../../widgets/ticker.svelte';
	import type { ElementViewProps } from '../registry';

	let { el }: ElementViewProps<WidgetElement> = $props();

	const ctx = getBoard();
	// The ticker drives redraws while it runs; the time itself is read fresh, so a change from a
	// peer (a timer just started) never draws with a stale clock.
	// Slow changes (a deadline's "in 3 days") redraw on their own interval while mounted, which
	// is while visible: culled widgets are unmounted.
	let slowTick = $state(0);
	const refreshMs = $derived.by(() => {
		const w = readWidget(el);
		return w?.def.refreshMs?.(w.config) ?? null;
	});
	$effect(() => {
		if (!refreshMs) return;
		const id = setInterval(() => slowTick++, refreshMs);
		return () => clearInterval(id);
	});
	const t = $derived.by(() => {
		void ticker.now;
		void slowTick;
		void el;
		return now();
	});

	// A linked doc card's checklist, recounted when that card's content changes (here or a peer's).
	const cardId = $derived(linkedCard(el));
	let cardVersion = $state(0);
	$effect(() => {
		const id = cardId;
		if (!id) return;
		const docs = getDocsMap(ctx.doc);
		const onDocs = (events: Y.YEvent<Y.AbstractType<unknown>>[]) => {
			const touched = events.some((e) =>
				e.target === docs ? (e as Y.YMapEvent<unknown>).keysChanged.has(id) : e.path[0] === id
			);
			if (touched) cardVersion++;
		};
		docs.observeDeep(onDocs);
		return () => docs.unobserveDeep(onDocs);
	});
	const tasks = $derived.by(() => {
		void cardVersion;
		const frag = cardId ? getDocsMap(ctx.doc).get(cardId) : undefined;
		return frag ? countTasks(fragmentToJSON(frag)) : null;
	});
	const env = $derived<WidgetEnv>({ tasks: (id) => (id === cardId ? tasks : null) });

	const motion = $derived(!reducedMotion?.current);
	const view = $derived(widgetView(el, t, motion, env));
	const hover = $derived(ctx.widgets.hover?.id === el.id ? ctx.widgets.hover.action : null);
	const markup = $derived(widgetSvgDocument(el, t, hover, motion, env));

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
