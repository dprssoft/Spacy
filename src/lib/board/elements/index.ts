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
import { rectFromPoints } from '../engine/geometry';
import { boxAABB, boxHitTest } from './common';
import PlaceholderView from './placeholder/PlaceholderView.svelte';
import { registerElement, type ElementDefinition } from './registry';
import ShapeView from './shape/ShapeView.svelte';
import StickyView from './sticky/StickyView.svelte';
import TextView from './text/TextView.svelte';

const boxDefaults = {
	aabb: boxAABB,
	hitTest: boxHitTest,
	connectable: null,
	resizable: true,
	rotatable: true,
	keepAspect: false,
	editableText: false,
	styleOptions: [] as string[]
};

registerElement<ShapeElement>({
	...boxDefaults,
	type: 'shape',
	component: ShapeView,
	editableText: true
});
registerElement<StickyElement>({
	...boxDefaults,
	type: 'sticky',
	component: StickyView,
	editableText: true
});
registerElement<TextElement>({
	...boxDefaults,
	type: 'text',
	component: TextView,
	editableText: true
});

// Placeholders until their steps: image/stroke (15), frame (16), connector (20), doccard (23).
registerElement<ImageElement>({ ...boxDefaults, type: 'image', component: PlaceholderView });
registerElement<StrokeElement>({ ...boxDefaults, type: 'stroke', component: PlaceholderView });
registerElement<FrameElement>({ ...boxDefaults, type: 'frame', component: PlaceholderView });
registerElement<DocCardElement>({ ...boxDefaults, type: 'doccard', component: PlaceholderView });

const endpointPoint = (e: Endpoint): Point =>
	e.kind === 'free' ? { x: e.x, y: e.y } : { x: e.lastX, y: e.lastY };

registerElement<ConnectorElement>({
	...boxDefaults,
	type: 'connector',
	component: PlaceholderView,
	aabb: (el) => rectFromPoints(endpointPoint(el.from), endpointPoint(el.to)),
	hitTest: () => false,
	resizable: false,
	rotatable: false
} satisfies ElementDefinition<ConnectorElement>);

export { allDefinitions, definitionOf, getDefinition } from './registry';
