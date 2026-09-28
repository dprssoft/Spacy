// Valid sample elements of every type, for tests. Not imported by app code.
import { baseStyleFor } from './defaults';
import type { Element, ElementOf, ElementType } from './types';

function base(type: ElementType, id: string, z: string) {
	return {
		id,
		x: 10,
		y: 20,
		w: 100,
		h: 50,
		rotation: 0,
		z,
		parentId: null,
		groupId: null,
		locked: false,
		style: baseStyleFor(type)
	};
}

export const samples: { [T in ElementType]: (id?: string, z?: string) => ElementOf<T> } = {
	shape: (id = 'shape1', z = 'a0') => ({
		...base('shape', id, z),
		type: 'shape',
		kind: 'rect',
		text: 'Box'
	}),
	sticky: (id = 'sticky1', z = 'a1') => ({
		...base('sticky', id, z),
		type: 'sticky',
		text: 'Note',
		color: '#ffe066'
	}),
	text: (id = 'text1', z = 'a2') => ({
		...base('text', id, z),
		type: 'text',
		text: 'Hello',
		autoWidth: true
	}),
	image: (id = 'image1', z = 'a3') => ({
		...base('image', id, z),
		type: 'image',
		assetId: 'asset1',
		naturalW: 640,
		naturalH: 480
	}),
	stroke: (id = 'stroke1', z = 'a4') => ({
		...base('stroke', id, z),
		type: 'stroke',
		points: [0, 0, 0.5, 10, 10, 0.5, 20, 5, 0.6]
	}),
	frame: (id = 'frame1', z = 'a5') => ({
		...base('frame', id, z),
		type: 'frame',
		title: 'Frame 1'
	}),
	doccard: (id = 'doc1', z = 'a6') => ({
		...base('doccard', id, z),
		type: 'doccard',
		title: 'Notes',
		collapsed: false,
		expandedH: 280
	}),
	connector: (id = 'conn1', z = 'a7') => ({
		...base('connector', id, z),
		type: 'connector',
		from: { kind: 'port', elementId: 'shape1', port: 'e', lastX: 110, lastY: 45 },
		to: { kind: 'free', x: 300, y: 45 },
		routing: 'elbow',
		waypoints: [{ x: 200, y: 45 }],
		markerStart: 'none',
		markerEnd: 'arrow',
		label: { text: 'yes', t: 0.5, background: true }
	})
};

export const allSamples = (): Element[] => Object.values(samples).map((make) => make());
