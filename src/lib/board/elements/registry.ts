import type { Component } from 'svelte';
import type { Element, ElementType, Point, Rect } from '$lib/model/types';
import type { Connectable } from '../diagram/connectable';
import type { DiagramWorld } from '../diagram/endpoints';
import type { SizeLimits } from '../engine/transform';
import type { StyleOption } from '../style/options';

export interface ElementViewProps<E extends Element = Element> {
	el: E;
	editing: boolean;
}

/** Everything the canvas needs to know about one element type (00-architecture.md §9). */
export interface ElementDefinition<E extends Element = Element> {
	type: E['type'];
	component: Component<ElementViewProps<E>>;
	/**
	 * World-space axis-aligned bounds (rotation applied). `world` gives access to other elements
	 * (connectors derive their geometry from the elements they attach to).
	 */
	aabb(el: E, world?: DiagramWorld): Rect;
	/** Precise hit test; `tol` is in world units. */
	hitTest(el: E, p: Point, tol: number, world?: DiagramWorld): boolean;
	/** How connectors attach; null only for connectors themselves. */
	connectable: Connectable<E> | null;
	resizable: boolean;
	rotatable: boolean;
	/** Size limits when resized on its own (default: the select tool's small minimum). */
	sizeLimits?(el: E): SizeLimits;
	/** Keep the aspect ratio on resize by default (images). */
	keepAspect: boolean;
	/** Double-click edits text. */
	editableText: boolean;
	/** Popover controls that apply to this type. */
	styleOptions: readonly StyleOption[];
}

const definitions = new Map<ElementType, ElementDefinition>();

export function registerElement<E extends Element>(def: ElementDefinition<E>): void {
	definitions.set(def.type, def as unknown as ElementDefinition);
}

export function getDefinition<T extends ElementType>(
	type: T
): ElementDefinition<Extract<Element, { type: T }>> {
	const def = definitions.get(type);
	if (!def) throw new Error(`No element definition registered for "${type}"`);
	return def as unknown as ElementDefinition<Extract<Element, { type: T }>>;
}

/** The definition for an element instance (convenience for the union type). */
export function definitionOf(el: Element): ElementDefinition {
	return getDefinition(el.type) as unknown as ElementDefinition;
}

export function allDefinitions(): ElementDefinition[] {
	return [...definitions.values()];
}
