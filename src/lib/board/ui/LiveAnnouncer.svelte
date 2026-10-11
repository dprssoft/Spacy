<script lang="ts">
	import { getElementsMap, readElement } from '$lib/model/doc';
	import { LOCAL } from '$lib/model/origins';
	import type { Element } from '$lib/model/types';
	import { describeChange, describeSelection, describeTool } from '../a11y/describe';
	import { getBoard } from '../context';
	import { SHAPE_KINDS } from '../elements/shape/paths';

	// Speaks tool changes, selection changes and local create/delete to screen readers.
	const ctx = getBoard();
	let message = $state('');
	let timer: ReturnType<typeof setTimeout> | null = null;

	/** Coalesces bursts (a create also changes the selection): the last message in a tick wins. */
	function say(text: string, priority = 0) {
		if (!text || priority < pending) return;
		pending = priority;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			message = text;
			pending = 0;
			timer = null;
		}, 60);
	}
	let pending = 0;

	let firstTool = true;
	$effect(() => {
		const tool = ctx.tools.current;
		const kind = SHAPE_KINDS.find((k) => k.kind === ctx.tools.shapeKind)?.label;
		if (firstTool) {
			firstTool = false;
			return;
		}
		say(describeTool(tool, kind));
	});

	let lastSelection = '';
	$effect(() => {
		const ids = [...ctx.selection.ids];
		const key = ids.join(',');
		if (key === lastSelection) return;
		const had = lastSelection !== '';
		lastSelection = key;
		if (ids.length === 0 && !had) return;
		say(describeSelection(ids.flatMap((id) => ctx.store.get(id) ?? [])));
	});

	let firstPage = true;
	$effect(() => {
		const name = ctx.pages.page.name;
		if (firstPage) {
			firstPage = false;
			return;
		}
		say(name, 3);
	});

	$effect(() => {
		void ctx.pages.current; // each page has its own element map
		const map = getElementsMap(ctx.doc);
		const onChange = (e: {
			transaction: { origin: unknown };
			changes: { keys: Map<string, { action: string; oldValue: unknown }> };
		}) => {
			if (e.transaction.origin !== LOCAL) return;
			const created: Element[] = [];
			let deleted = 0;
			for (const [id, change] of e.changes.keys) {
				if (change.action === 'add') {
					const ymap = map.get(id);
					const el = ymap ? readElement(ymap) : null;
					if (el) created.push(el);
				} else if (change.action === 'delete') deleted++;
			}
			// Creation and deletion outrank the selection change they cause.
			if (created.length) say(describeChange('created', created), 2);
			else if (deleted) say(deleted === 1 ? 'Element deleted' : `${deleted} elements deleted`, 2);
		};
		map.observe(onChange);
		return () => map.unobserve(onChange);
	});

	// Widgets: a timer that ran out, a wheel's winner…
	$effect(() => {
		const a = ctx.widgets.announcement;
		if (a) say(a.text, 2);
	});

	$effect(() => () => {
		if (timer) clearTimeout(timer);
	});
</script>

<div class="sr-only" aria-live="polite" aria-atomic="true" data-testid="announcer">{message}</div>
