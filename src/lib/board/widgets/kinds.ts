import type { Rect, WidgetElement } from '$lib/model/types';

// What each widget kind is, without any UI: parsing, the face it shows, its clickable zones and
// what they do. Pure, so exports, the scene canvas and tests share it with the live view.

export type WidgetGroup = 'Facilitation' | 'Team' | 'Writing';
export const WIDGET_GROUPS: readonly WidgetGroup[] = ['Facilitation', 'Team', 'Writing'];

/** A built-in icon name (see face.ts) or a short text label. */
export type Glyph = 'play' | 'pause' | 'reset' | { text: string };

export interface WidgetAction {
	id: string;
	label: string;
	glyph: Glyph;
	/** In the kind's design space (`design`). */
	rect: Rect;
	primary?: boolean;
	/** Shown dimmed; clicking it does nothing (e.g. Spin while the wheel turns). */
	disabled?: boolean;
	/** Pressing it starts a drag that edits the config (`dragTo`) instead of a click. */
	drag?: boolean;
	/** Drawn by the kind's art (a status chip, a progress bar), not as a button. */
	bare?: boolean;
}

/** Done and total task items of a doc card's checklist. */
export interface TaskCount {
	done: number;
	total: number;
}

/** What a widget can read from the rest of the board (a linked card's checklist). */
export interface WidgetEnv {
	/** Null when the card is missing or has no tasks. */
	tasks(cardId: string): TaskCount | null;
}

export const NO_ENV: WidgetEnv = { tasks: () => null };

/** What the generic face draws: a ring (0..1, or none), a big headline and a caption. */
export interface WidgetFace {
	headline: string;
	caption: string;
	ring: number | null;
	accent: string;
	/** Brief emphasis, e.g. a finished timer. */
	alert?: boolean;
}

/** The result of an action: what to write (config is undoable, state isn't). */
export interface WidgetWrite<C, S> {
	config?: C;
	state?: S;
	/** Spoken through the live announcer. */
	announce?: string;
	/** Sticky notes to create next to the widget, one column per inner list (one undo step). */
	place?: string[][];
}

/** How the live view (or an export) draws. */
export interface ArtOptions {
	/** False with reduced motion: no turning, tumbling or shuffling. */
	motion: boolean;
	ink: string;
	title: string;
}

export interface WidgetKind<C = unknown, S = unknown> {
	kind: string;
	label: string;
	group: WidgetGroup;
	/** The design space the face and zones are drawn in; also the default size. */
	design: { w: number; h: number };
	parseConfig(raw: unknown): C;
	parseState(raw: unknown): S;
	defaultConfig(): C;
	defaultState(): S;
	face(config: C, state: S, now: number, title: string, env?: WidgetEnv): WidgetFace;
	actions(config: C, state: S, now: number): WidgetAction[];
	/**
	 * A drag on a `drag` action at `p` (design space): the config it sets, or null. `fine`: Shift
	 * held (finer steps).
	 */
	dragTo?(action: string, config: C, p: { x: number; y: number }, fine: boolean): C | null;
	/** The doc card it reads from, if any (the hint line while selected). */
	linkedCard?(config: C): string | null;
	/**
	 * How often the face changes by itself when that's slow (a deadline's "in 3 days"), in ms;
	 * null when it doesn't. Fast changes use `ticking`.
	 */
	refreshMs?(config: C): number | null;
	/** `seed`: 32 random bits for kinds that draw lots (results are derived from it). */
	perform(action: string, config: C, state: S, now: number, seed: number): WidgetWrite<C, S> | null;
	/**
	 * Its own drawing in the design space, above the buttons, instead of the generic ring,
	 * headline and caption (which still name it in the zoomed-out view).
	 */
	art?(config: C, state: S, now: number, opts: ArtOptions, env?: WidgetEnv): string;
	/** True while the face changes with time (the view subscribes to the ticker). */
	ticking(config: C, state: S, now: number): boolean;
	/**
	 * Something that just ended (a countdown reaching 0) for tabs showing it to sound and announce
	 * once. `key` tells runs apart; null when nothing ended in the last moments.
	 */
	finished?(
		config: C,
		state: S,
		now: number
	): { key: string; sound: boolean; message: string } | null;
}

const kinds = new Map<string, WidgetKind>();

export function registerWidgetKind<C, S>(def: WidgetKind<C, S>): void {
	kinds.set(def.kind, def as unknown as WidgetKind);
}

export const widgetKind = (kind: string): WidgetKind | undefined => kinds.get(kind);
export const allWidgetKinds = (): WidgetKind[] => [...kinds.values()];

/** A widget's config and state read through its kind; undefined for unknown kinds. */
export function readWidget(el: WidgetElement) {
	const def = widgetKind(el.kind);
	if (!def) return undefined;
	return { def, config: def.parseConfig(el.config), state: def.parseState(el.state) };
}

export const UNKNOWN_FACE: WidgetFace = {
	headline: '?',
	caption: 'Needs a newer version of Spacy',
	ring: null,
	accent: '#868e96'
};

/** The face, actions and ticking of any widget (unknown kinds: a placeholder, no actions). */
export function widgetView(
	el: WidgetElement,
	now: number,
	motion = true,
	env: WidgetEnv = NO_ENV
): {
	face: WidgetFace;
	actions: WidgetAction[];
	ticking: boolean;
	design: { w: number; h: number };
	art: string | null;
} {
	const w = readWidget(el);
	if (!w)
		return {
			face: UNKNOWN_FACE,
			actions: [],
			ticking: false,
			design: { w: el.w, h: el.h },
			art: null
		};
	const { def, config, state } = w;
	return {
		face: def.face(config, state, now, el.title, env),
		actions: def.actions(config, state, now),
		ticking: def.ticking(config, state, now),
		design: def.design,
		art:
			def.art?.(config, state, now, { motion, ink: el.style.font.color, title: el.title }, env) ??
			null
	};
}

/** The doc card a widget reads from, if any. */
export function linkedCard(el: WidgetElement): string | null {
	const w = readWidget(el);
	return w?.def.linkedCard?.(w.config) ?? null;
}
