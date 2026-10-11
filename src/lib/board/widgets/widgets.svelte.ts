import { newElementBase, STICKY_COLORS } from '$lib/model/defaults';
import { newId } from '$lib/model/ids';
import { createElements } from '$lib/model/ops';
import type { NewElement, WidgetElement } from '$lib/model/types';
import { setWidgetConfig, setWidgetState } from '$lib/model/widgets';
import { getDefaultStyle } from '../style/styleDefaults';
import type { BoardContext } from '../context';
import { now } from './clock';
import { readWidget } from './kinds';
import { ticker } from './ticker.svelte';
import './index';

type Ctx = Pick<BoardContext, 'doc' | 'undo' | 'store' | 'selection'>;

const STICKY = 160;
const GAP = 16;
const COLUMN_COLORS = Object.values(STICKY_COLORS);

function randomSeed(): number {
	return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

/** Per-tab widget UI state: hover, the settings popover, and running actions. */
export class WidgetsState {
	/** The action under the pointer (hover highlight and cursor). */
	hover = $state<{ id: string; action: string } | null>(null);
	/** The widget whose settings are open. */
	settingsId = $state<string | null>(null);
	/** The latest message for screen readers. */
	announcement = $state<{ text: string; seq: number } | null>(null);
	readonly #ctx: Ctx;

	constructor(ctx: Ctx) {
		this.#ctx = ctx;
	}

	/** Runs a widget action. Config changes are one undo step; state changes aren't undoable. */
	run(id: string, action: string): boolean {
		const { doc, undo, store } = this.#ctx;
		const el = store.get(id);
		if (el?.type !== 'widget') return false;
		const w = readWidget(el);
		if (!w) return false;
		const t = now();
		if (w.def.actions(w.config, w.state, t).find((a) => a.id === action)?.disabled) return false;
		const write = w.def.perform(action, w.config, w.state, t, randomSeed());
		if (!write) return false;
		if (write.config !== undefined) {
			// A locked widget runs, but its setup doesn't change.
			if (el.locked) return false;
			undo.stopCapturing();
			setWidgetConfig(doc, id, write.config);
			undo.stopCapturing();
		}
		if (write.state !== undefined) setWidgetState(doc, id, write.state);
		if (write.place?.some((col) => col.length > 0)) this.#place(el, write.place);
		if (write.announce) this.announce(write.announce);
		ticker.refresh();
		return true;
	}

	/** Sticky notes in columns to the right of the widget, selected, as one undo step. */
	#place(el: WidgetElement, columns: string[][]): void {
		const { doc, undo, selection } = this.#ctx;
		const els: NewElement[] = columns.flatMap((col, c) =>
			col.map((text, r) => {
				const x = el.x + el.w + 40 + c * (STICKY + GAP) + STICKY / 2;
				const y = el.y + r * (STICKY + GAP) + STICKY / 2;
				const base = newElementBase('sticky', newId(), { x, y }, getDefaultStyle('sticky'));
				return {
					...base,
					w: STICKY,
					h: STICKY,
					x: x - STICKY / 2,
					y: y - STICKY / 2,
					type: 'sticky' as const,
					text,
					color: COLUMN_COLORS[(columns.length > 1 ? c : 0) % COLUMN_COLORS.length]!
				};
			})
		);
		undo.stopCapturing();
		const created = createElements(doc, els);
		undo.stopCapturing();
		selection.set(created.map((e) => e.id));
	}

	announce(text: string): void {
		this.announcement = { text, seq: (this.announcement?.seq ?? 0) + 1 };
	}

	openSettings(id: string): void {
		this.settingsId = id;
	}

	closeSettings(): void {
		this.settingsId = null;
	}
}
