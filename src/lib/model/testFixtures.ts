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
	sketch: (id = 'sketch1', z = 'a8') => ({
		...base('sketch', id, z),
		type: 'sketch',
		bx: 0,
		by: 0,
		nw: 100,
		nh: 50
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
	}),
	media: (id = 'media1', z = 'a8') => ({
		...base('media', id, z),
		type: 'media',
		url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
		provider: 'youtube',
		mediaId: 'dQw4w9WgXcQ',
		start: 0,
		end: null,
		loop: false,
		title: 'YouTube video'
	}),
	waystone: (id = 'waystone1', z = 'a9') => ({
		...base('waystone', id, z),
		type: 'waystone',
		name: 'Act II',
		zoom: 1,
		order: 'a0'
	}),
	widget: (id = 'widget1', z = 'aA') => ({
		...base('widget', id, z),
		type: 'widget',
		kind: 'timer',
		title: '',
		config: { mode: 'countdown', duration: 300, sound: true },
		state: { startedAt: null, elapsed: 0 }
	})
};

export const allSamples = (): Element[] => Object.values(samples).map((make) => make());
