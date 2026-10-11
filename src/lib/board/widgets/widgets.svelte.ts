import { setWidgetConfig, setWidgetState } from '$lib/model/widgets';
import type { BoardContext } from '../context';
import { now } from './clock';
import { readWidget } from './kinds';
import { ticker } from './ticker.svelte';
import './index';

/** Per-tab widget UI state: hover, the settings popover, and running actions. */
export class WidgetsState {
	/** The action under the pointer (hover highlight and cursor). */
	hover = $state<{ id: string; action: string } | null>(null);
	/** The widget whose settings are open. */
	settingsId = $state<string | null>(null);
	/** The latest message for screen readers. */
	announcement = $state<{ text: string; seq: number } | null>(null);
	readonly #ctx: Pick<BoardContext, 'doc' | 'undo' | 'store'>;

	constructor(ctx: Pick<BoardContext, 'doc' | 'undo' | 'store'>) {
		this.#ctx = ctx;
	}

	/** Runs a widget action. Config changes are one undo step; state changes aren't undoable. */
	run(id: string, action: string): boolean {
		const { doc, undo, store } = this.#ctx;
		const el = store.get(id);
		if (el?.type !== 'widget') return false;
		const w = readWidget(el);
		if (!w) return false;
		const write = w.def.perform(action, w.config, w.state, now());
		if (!write) return false;
		if (write.config !== undefined) {
			// A locked widget runs, but its setup doesn't change.
			if (el.locked) return false;
			undo.stopCapturing();
			setWidgetConfig(doc, id, write.config);
			undo.stopCapturing();
		}
		if (write.state !== undefined) setWidgetState(doc, id, write.state);
		if (write.announce) this.announce(write.announce);
		ticker.refresh();
		return true;
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
