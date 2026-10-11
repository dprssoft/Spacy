import { z } from '$lib/shared/zod';
import { ZOOM_MAX, ZOOM_MIN } from './defaults';
import type { Element } from './types';

const num = z.number(); // zod rejects NaN and ±Infinity
const nonNeg = z.number().nonnegative();

export const pointSchema = z.object({ x: num, y: num });
export const rectSchema = z.object({ x: num, y: num, w: nonNeg, h: nonNeg });

export const styleSchema = z.object({
	fill: z.string(),
	fillStyle: z.enum(['none', 'solid', 'semi']),
	stroke: z.string(),
	strokeWidth: z.literal([1, 2, 4, 8]),
	dash: z.enum(['solid', 'dashed', 'dotted']),
	radius: z.enum(['none', 'sm', 'lg']),
	shadow: z.boolean(),
	opacity: z.number().min(0.1).max(1),
	font: z.object({
		size: z.enum(['s', 'm', 'l', 'xl']),
		bold: z.boolean(),
		italic: z.boolean(),
		color: z.string(),
		align: z.enum(['l', 'c', 'r']),
		valign: z.enum(['t', 'm', 'b']),
		family: z.string().max(40).optional()
	})
});

const base = {
	id: z.string().min(1),
	x: num,
	y: num,
	w: nonNeg,
	h: nonNeg,
	rotation: num,
	z: z.string().min(1),
	parentId: z.string().nullable(),
	groupId: z.string().nullable(),
	locked: z.boolean(),
	style: styleSchema
};

export const shapeKindSchema = z.enum([
	'rect',
	'ellipse',
	'diamond',
	'process',
	'decision',
	'terminator',
	'data',
	'document',
	'database',
	'cloud',
	'actor'
]);

export const portSchema = z.enum(['n', 'e', 's', 'w']);
const unit = z.number().min(0).max(1);

export const endpointSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('free'), x: num, y: num }),
	z.object({
		kind: z.literal('port'),
		elementId: z.string().min(1),
		port: portSchema,
		lastX: num,
		lastY: num
	}),
	z.object({ kind: z.literal('float'), elementId: z.string().min(1), lastX: num, lastY: num }),
	z.object({
		kind: z.literal('fixed'),
		elementId: z.string().min(1),
		u: unit,
		v: unit,
		lastX: num,
		lastY: num
	})
]);

export const markerSchema = z.enum([
	'none',
	'arrow',
	'openArrow',
	'triangle',
	'diamond',
	'circle',
	'bar'
]);

export const shapeSchema = z.object({
	...base,
	type: z.literal('shape'),
	kind: shapeKindSchema,
	text: z.string()
});
export const stickySchema = z.object({
	...base,
	type: z.literal('sticky'),
	text: z.string(),
	color: z.string()
});
export const textSchema = z.object({
	...base,
	type: z.literal('text'),
	text: z.string(),
	autoWidth: z.boolean()
});
export const imageSchema = z.object({
	...base,
	type: z.literal('image'),
	assetId: z.string().min(1),
	naturalW: nonNeg,
	naturalH: nonNeg
});
export const strokeSchema = z.object({
	...base,
	type: z.literal('stroke'),
	points: z.array(num)
});
export const sketchSchema = z.object({
	...base,
	type: z.literal('sketch'),
	bx: num,
	by: num,
	nw: nonNeg,
	nh: nonNeg
});
export const frameSchema = z.object({ ...base, type: z.literal('frame'), title: z.string() });
export const docCardSchema = z.object({
	...base,
	type: z.literal('doccard'),
	title: z.string(),
	collapsed: z.boolean(),
	expandedH: nonNeg
});
export const connectorSchema = z.object({
	...base,
	type: z.literal('connector'),
	from: endpointSchema,
	to: endpointSchema,
	routing: z.enum(['straight', 'elbow', 'curve']),
	waypoints: z.array(pointSchema),
	markerStart: markerSchema,
	markerEnd: markerSchema,
	label: z.object({ text: z.string(), t: unit, background: z.boolean() })
});

export const mediaSchema = z.object({
	...base,
	type: z.literal('media'),
	url: z
		.string()
		.max(2048)
		.refine((u) => /^https:\/\/[^\s]+$/i.test(u), 'https URL'),
	provider: z.enum(['youtube', 'vimeo', 'video', 'audio']),
	mediaId: z
		.string()
		.regex(/^[\w-]{1,64}$/)
		.nullable(),
	start: nonNeg,
	end: nonNeg.nullable(),
	loop: z.boolean(),
	title: z.string().max(200)
});

export const waystoneSchema = z.object({
	...base,
	type: z.literal('waystone'),
	name: z.string().max(100),
	zoom: z.number().min(ZOOM_MIN).max(ZOOM_MAX),
	order: z.string().min(1)
});

// `config` and `state` are any JSON; each widget kind parses its own (board/widgets).
const json = z.custom<unknown>((v) => v !== undefined, 'required');

export const widgetSchema = z.object({
	...base,
	type: z.literal('widget'),
	kind: z.string().min(1).max(32),
	title: z.string().max(100),
	config: json,
	state: json
});

export const elementSchema = z.discriminatedUnion('type', [
	shapeSchema,
	stickySchema,
	textSchema,
	imageSchema,
	strokeSchema,
	sketchSchema,
	frameSchema,
	docCardSchema,
	connectorSchema,
	mediaSchema,
	waystoneSchema,
	widgetSchema
]);

// Compile-time guard: the schemas and the hand-written types must describe the same shape.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _schemaMatchesTypes: Same<z.infer<typeof elementSchema>, Element> = true;

/** Validates unknown input as an Element. Returns a fresh copy, or null if invalid. */
export function parseElement(input: unknown): Element | null {
	const result = elementSchema.safeParse(input);
	if (result.success) return result.data;
	if (import.meta.env?.DEV && import.meta.env.MODE !== 'test') {
		console.warn('Invalid element', result.error.issues, input);
	}
	return null;
}
