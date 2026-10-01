import type {
	ConnectorElement,
	DocCardElement,
	Endpoint,
	FrameElement,
	ImageElement,
	Point,
	ShapeElement,
	StickyElement,
	StrokeElement,
	TextElement
} from '$lib/model/types';
import { boxConnectable, polygonConnectable } from '../diagram/connectable';
import { rectFromPoints } from '../engine/geometry';
import { STYLE_OPTIONS, type StyleOption } from '../style/options';
import { boxAABB, boxHitTest } from './common';
import { frameAABB, frameHitTest } from './frame/geometry';
import FrameView from './frame/FrameView.svelte';
import ImageView from './image/ImageView.svelte';
import PlaceholderView from './placeholder/PlaceholderView.svelte';
import { registerElement, type ElementDefinition } from './registry';
import { shapeOutline } from './shape/paths';
import ShapeView from './shape/ShapeView.svelte';
import StickyView from './sticky/StickyView.svelte';
import { strokeAABB, strokeHitTest } from './stroke/geometry';
import StrokeView from './stroke/StrokeView.svelte';
import TextView from './text/TextView.svelte';

const boxDefaults = {
	aabb: boxAABB,
	hitTest: boxHitTest,
	connectable: boxConnectable,
	resizable: true,
	rotatable: true,
	keepAspect: false,
	editableText: false,
	styleOptions: [] as readonly StyleOption[]
};

registerElement<ShapeElement>({
	...boxDefaults,
	type: 'shape',
	styleOptions: STYLE_OPTIONS.shape,
	connectable: polygonConnectable<ShapeElement>((el) => shapeOutline(el.kind, el.w, el.h)),
	component: ShapeView,
	editableText: true
});
registerElement<StickyElement>({
	...boxDefaults,
	type: 'sticky',
	styleOptions: STYLE_OPTIONS.sticky,
	component: StickyView,
	editableText: true
});
registerElement<TextElement>({
	...boxDefaults,
	type: 'text',
	styleOptions: STYLE_OPTIONS.text,
	component: TextView,
	editableText: true
});

registerElement<ImageElement>({
	...boxDefaults,
	type: 'image',
	styleOptions: STYLE_OPTIONS.image,
	component: ImageView,
	keepAspect: true
});
registerElement<StrokeElement>({
	...boxDefaults,
	type: 'stroke',
	styleOptions: STYLE_OPTIONS.stroke,
	component: StrokeView,
	aabb: strokeAABB,
	hitTest: strokeHitTest
});

registerElement<FrameElement>({
	...boxDefaults,
	type: 'frame',
	styleOptions: STYLE_OPTIONS.frame,
	component: FrameView,
	aabb: frameAABB,
	hitTest: frameHitTest,
	rotatable: false,
	editableText: true
});

// Placeholders until their steps: connector (20), doccard (23).
registerElement<DocCardElement>({
	...boxDefaults,
	type: 'doccard',
	styleOptions: STYLE_OPTIONS.doccard,
	component: PlaceholderView
});

const endpointPoint = (e: Endpoint): Point =>
	e.kind === 'free' ? { x: e.x, y: e.y } : { x: e.lastX, y: e.lastY };

registerElement<ConnectorElement>({
	...boxDefaults,
	type: 'connector',
	styleOptions: STYLE_OPTIONS.connector,
	component: PlaceholderView,
	aabb: (el) => rectFromPoints(endpointPoint(el.from), endpointPoint(el.to)),
	hitTest: () => false,
	connectable: null,
	resizable: false,
	rotatable: false
} satisfies ElementDefinition<ConnectorElement>);

export { allDefinitions, definitionOf, getDefinition } from './registry';
