import type { Point } from '$lib/model/types';

export type ToolId =
	| 'select'
	| 'hand'
	| 'pen'
	| 'eraser'
	| 'sketch'
	| 'shape'
	| 'connector'
	| 'text'
	| 'sticky'
	| 'doccard'
	| 'frame'
	| 'image'
	| 'waystone';

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate' | (string & {});

export interface CanvasPointerEvent {
	world: Point;
	screen: Point;
	button: number;
	/** True while a button is held (false for hover moves). */
	dragging: boolean;
	pointerId: number;
	pointerType: string;
	pressure: number;
	shift: boolean;
	alt: boolean;
	/** Ctrl on Windows/Linux, Cmd on macOS. */
	mod: boolean;
	hit: { elementId?: string; handle?: HandleId };
	native: PointerEvent | MouseEvent;
}

export interface Tool {
	id: ToolId;
	readonly cursor: string;
	onPointerDown(e: CanvasPointerEvent): void;
	/** Receives drag moves and, with `dragging: false`, hover moves. */
	onPointerMove(e: CanvasPointerEvent): void;
	onPointerUp(e: CanvasPointerEvent): void;
	onDoubleClick?(e: CanvasPointerEvent): void;
	/** Return true if handled (stops shortcut processing). */
	onKeyDown?(e: KeyboardEvent): boolean;
	/** Escape, tool switch or lost pointer capture. */
	onCancel(): void;
}
