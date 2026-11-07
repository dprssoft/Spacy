import type {
	ConnectorElement,
	DocCardElement,
	Endpoint,
	FrameElement,
	ImageElement,
	MediaElement,
	WaystoneElement,
	WidgetElement,
	Point,
	ShapeElement,
	SketchElement,
	StickyElement,
	StrokeElement,
	TableElement,
	TextElement
} from '$lib/model/types';
import { boxConnectable } from '../diagram/connectable';
import { shapeConnectable } from './connectables';
import { connectorGeometry, distToPolyline, inRect } from '../diagram/geometry';
import ConnectorView from './connector/ConnectorView.svelte';
import { docCardLimits } from './doccard/collapse';
import DocCardView from './doccard/DocCardView.svelte';
import { rectFromPoints } from '../engine/geometry';
import { STYLE_OPTIONS, type StyleOption } from '../style/options';
import { boxAABB, boxHitTest, fillColor } from './common';
import { frameAABB, frameHitTest } from './frame/geometry';
import FrameView from './frame/FrameView.svelte';
import { sketchHit } from '../sketch/geometry';
import SketchView from './sketch/SketchView.svelte';
import ImageView from './image/ImageView.svelte';
import MediaView from './media/MediaView.svelte';
import WaystoneView from './waystone/WaystoneView.svelte';
import WidgetView from './widget/WidgetView.svelte';
import { registerElement, type ElementDefinition } from './registry';
import ShapeView from './shape/ShapeView.svelte';
import StickyView from './sticky/StickyView.svelte';
import { strokeAABB, strokeHitTest } from './stroke/geometry';
import StrokeView from './stroke/StrokeView.svelte';
import TableView from './table/TableView.svelte';
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
	connectable: shapeConnectable,
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

registerElement<SketchElement>({
	...boxDefaults,
	type: 'sketch',
	styleOptions: STYLE_OPTIONS.sketch,
	component: SketchView,
	// A transparent sheet is clickable on its strokes only, so a large sketch doesn't cover what is
	// around it; a colored sheet is a solid object.
	hitTest: (el, p, tol, world) =>
		world?.strokes && fillColor(el.style) === 'transparent'
			? sketchHit(el, world.strokes(el.id), p, tol)
			: boxHitTest(el, p, tol),
	// Its frame follows the drawing; a rotated frame couldn't grow in place.
	rotatable: false,
	keepAspect: true
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

registerElement<DocCardElement>({
	...boxDefaults,
	type: 'doccard',
	styleOptions: STYLE_OPTIONS.doccard,
	component: DocCardView,
	sizeLimits: docCardLimits,
	// A rotated editor is hard to use and its caret placement breaks.
	rotatable: false,
	editableText: true
});

const endpointPoint = (e: Endpoint): Point =>
	e.kind === 'free' ? { x: e.x, y: e.y } : { x: e.lastX, y: e.lastY };

registerElement<ConnectorElement>({
	...boxDefaults,
	type: 'connector',
	styleOptions: STYLE_OPTIONS.connector,
	component: ConnectorView,
	aabb: (el, world) =>
		world
			? connectorGeometry(el, world).bounds
			: rectFromPoints(endpointPoint(el.from), endpointPoint(el.to)),
	hitTest: (el, p, tol, world) => {
		if (!world) return false;
		const g = connectorGeometry(el, world);
		return distToPolyline(g.points, p) <= tol + el.style.strokeWidth / 2 + 2 || inRect(g.label, p);
	},
	connectable: null,
	editableText: true,
	resizable: false,
	rotatable: false
} satisfies ElementDefinition<ConnectorElement>);

registerElement<MediaElement>({
	...boxDefaults,
	type: 'media',
	styleOptions: STYLE_OPTIONS.media,
	component: MediaView,
	rotatable: false,
	keepAspect: true,
	sizeLimits: () => ({ minW: 160, minH: 64 })
});

registerElement<WaystoneElement>({
	...boxDefaults,
	type: 'waystone',
	styleOptions: STYLE_OPTIONS.waystone,
	component: WaystoneView,
	resizable: false,
	rotatable: false
});

registerElement<WidgetElement>({
	...boxDefaults,
	type: 'widget',
	styleOptions: STYLE_OPTIONS.widget,
	component: WidgetView,
	// Hit-testing and its buttons assume an unrotated box.
	rotatable: false,
	keepAspect: true,
	sizeLimits: () => ({ minW: 80, minH: 80 })
});

registerElement<TableElement>({
	...boxDefaults,
	type: 'table',
	styleOptions: STYLE_OPTIONS.table,
	component: TableView,
	// A rotated editor is hard to use; the height follows the content.
	rotatable: false,
	editableText: true,
	sizeLimits: () => ({ minW: 120, minH: 32 })
});

export { allDefinitions, definitionOf, getDefinition } from './registry';
