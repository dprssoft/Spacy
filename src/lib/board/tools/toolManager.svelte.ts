import type { ShapeKind } from '$lib/model/types';
import type { BoardContext } from '../context';
import { createHandTool } from './hand.svelte';
import { createSelectTool } from './select';
import { createShapeTool } from './shape';
import { createStickyTool } from './sticky';
import { createTextTool } from './text';
import type { Tool, ToolId } from './types';

export type ToolFactory = (ctx: BoardContext) => Tool;

/** The active tool and tool options. Tools are created lazily, once per board. */
export class ToolManager {
	current = $state<ToolId>('select');
	/** Keep the tool active after creating something (toolbar lock). */
	locked = $state(false);
	/** Shape kind used by the shape tool (R / O / D and the shapes flyout). */
	shapeKind = $state<ShapeKind>('rect');

	readonly #ctx: BoardContext;
	// Registration and instance caches, not UI state.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	readonly #factories = new Map<ToolId, ToolFactory>();
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	readonly #tools = new Map<ToolId, Tool>();

	constructor(ctx: BoardContext) {
		this.#ctx = ctx;
		this.register('select', createSelectTool);
		this.register('hand', createHandTool);
		this.register('shape', createShapeTool);
		this.register('sticky', createStickyTool);
		this.register('text', createTextTool);
	}

	/** Later steps register their tools here. */
	register(id: ToolId, factory: ToolFactory): void {
		this.#factories.set(id, factory);
		this.#tools.delete(id);
	}

	isAvailable(id: ToolId): boolean {
		return this.#factories.has(id);
	}

	get tool(): Tool {
		return this.#get(this.current) ?? this.#get('select')!;
	}

	setTool(id: ToolId): void {
		if (!this.isAvailable(id) || id === this.current) return;
		this.tool.onCancel();
		this.current = id;
	}

	/** Back to the select tool after creating something, unless the tool is locked. */
	returnToSelect(): void {
		if (!this.locked) this.setTool('select');
	}

	#get(id: ToolId): Tool | undefined {
		let tool = this.#tools.get(id);
		if (!tool) {
			const factory = this.#factories.get(id);
			if (!factory) return undefined;
			tool = factory(this.#ctx);
			this.#tools.set(id, tool);
		}
		return tool;
	}
}
