// Canonical data model — must match plan/00-architecture.md §5 exactly.

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

export type ElementType =
	| 'shape'
	| 'sticky'
	| 'text'
	| 'image'
	| 'stroke'
	| 'sketch'
	| 'frame'
	| 'doccard'
	| 'connector'
	| 'media';

export type ShapeKind =
	| 'rect'
	| 'ellipse'
	| 'diamond' // basic (toolbar)
	| 'process'
	| 'decision'
	| 'terminator'
	| 'data' // flowchart library (step 22)
	| 'document'
	| 'database'
	| 'cloud'
	| 'actor';

export type StrokeWidth = 1 | 2 | 4 | 8;
export type FontSize = 's' | 'm' | 'l' | 'xl'; // 14 / 18 / 24 / 36 px at zoom 1

export interface Style {
	fill: string; // CSS color or 'transparent'
	fillStyle: 'none' | 'solid' | 'semi'; // semi = fill at 25% alpha
	stroke: string;
	strokeWidth: StrokeWidth;
	dash: 'solid' | 'dashed' | 'dotted';
	radius: 'none' | 'sm' | 'lg'; // 0 / 8 / 20 px
	shadow: boolean;
	opacity: number; // 0.1..1
	font: {
		size: FontSize;
		bold: boolean;
		italic: boolean;
		color: string;
		align: 'l' | 'c' | 'r';
		valign: 't' | 'm' | 'b';
		/** A font id from `$lib/fonts/catalog`; missing or unknown means the default font. */
		family?: string;
	};
}

export interface BaseElement {
	id: string;
	type: ElementType;
	x: number;
	y: number; // top-left of the unrotated box, world units
	w: number;
	h: number;
	rotation: number; // radians, around box center
	z: string; // fractional index; compare with plain < / >
	parentId: string | null; // frame id
	groupId: string | null; // flat groups: elements sharing a groupId
	locked: boolean;
	style: Style;
}

export interface ShapeElement extends BaseElement {
	type: 'shape';
	kind: ShapeKind;
	text: string;
}
export interface StickyElement extends BaseElement {
	type: 'sticky';
	text: string;
	color: string;
}
export interface TextElement extends BaseElement {
	type: 'text';
	text: string;
	autoWidth: boolean;
}
export interface ImageElement extends BaseElement {
	type: 'image';
	assetId: string;
	naturalW: number;
	naturalH: number;
}
export interface StrokeElement extends BaseElement {
	type: 'stroke';
	points: number[]; // flat [x,y,p,...] relative to (x,y), unscaled
}
/**
 * A drawing made of many brush strokes in one object. The strokes live in `doc.getMap('sketches')`
 * (append-only, keyed by element id) in the sketch's own coordinates; `bx, by, nw, nh` is the
 * rectangle of that space the element's box shows. It grows as strokes are added and is stretched
 * onto `w × h`, so moving or resizing the element never rewrites stroke data.
 */
export interface SketchElement extends BaseElement {
	type: 'sketch';
	bx: number;
	by: number;
	nw: number;
	nh: number;
}
export interface FrameElement extends BaseElement {
	type: 'frame';
	title: string;
}
export interface DocCardElement extends BaseElement {
	type: 'doccard';
	title: string;
	collapsed: boolean;
	expandedH: number;
}

export type MediaProvider = 'youtube' | 'vimeo' | 'video' | 'audio';
/**
 * A link that plays on the board (schema version 5). Nothing is fetched from the provider until
 * the user presses play; embeds are built from `mediaId`, never from `url`.
 */
export interface MediaElement extends BaseElement {
	type: 'media';
	url: string; // what the user entered (https only), shown and exported
	provider: MediaProvider; // parsed once from the URL when created
	mediaId: string | null; // provider video id (youtube/vimeo); null for files
	start: number; // seconds (0 = from the start)
	end: number | null; // seconds; play only up to here. null = to the end
	loop: boolean; // restart at `start` at `end` or the end
	title: string; // label on the poster
}

export type Port = 'n' | 'e' | 's' | 'w';

export type Endpoint =
	| { kind: 'free'; x: number; y: number }
	| { kind: 'port'; elementId: string; port: Port; lastX: number; lastY: number }
	| { kind: 'float'; elementId: string; lastX: number; lastY: number }
	| { kind: 'fixed'; elementId: string; u: number; v: number; lastX: number; lastY: number }; // u,v ∈ [0,1] local

export type Routing = 'straight' | 'elbow' | 'curve';
export type Marker = 'none' | 'arrow' | 'openArrow' | 'triangle' | 'diamond' | 'circle' | 'bar';

export interface ConnectorElement extends BaseElement {
	type: 'connector'; // x,y,w,h,rotation unused (0) — geometry is derived (D8)
	from: Endpoint;
	to: Endpoint;
	routing: Routing;
	waypoints: Point[]; // manual bends; [] = automatic
	markerStart: Marker;
	markerEnd: Marker;
	label: { text: string; t: number; background: boolean }; // t ∈ [0,1] along path length
}

export type Element =
	| ShapeElement
	| StickyElement
	| TextElement
	| ImageElement
	| StrokeElement
	| SketchElement
	| FrameElement
	| DocCardElement
	| ConnectorElement
	| MediaElement;

// Helpers for working with the Element union (not part of the stored model).
export type ElementOf<T extends ElementType> = Extract<Element, { type: T }>;
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** An element before it has a z key; `createElements` assigns one when missing. */
export type NewElement = DistributiveOmit<Element, 'z'> & { z?: string };
type AllKeys<T> = T extends unknown ? keyof T : never;
type ValueOf<T, K extends PropertyKey> = T extends unknown
	? K extends keyof T
		? T[K]
		: never
	: never;
/** A partial update for any element type; the merged result is validated at runtime. */
export type ElementPatch = { [K in AllKeys<Element>]?: ValueOf<Element, K> };
