import type { ViewportState } from '../viewport.svelte';

export interface ViewportInputOptions {
	/** Called when hand-panning starts/stops (for the cursor). */
	onPanningChange?(panning: boolean, spaceHeld: boolean): void;
}

function isTypingTarget(t: EventTarget | null): boolean {
	return (
		t instanceof HTMLElement &&
		(t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
	);
}

const LINE_PX = 16;
const MAX_ZOOM_DELTA = 30; // clamp: one mouse-wheel notch ≈ 30 % zoom, trackpad pinch stays smooth
const ZOOM_SPEED = 0.012;

/**
 * Pan/zoom input on the canvas container: wheel & trackpad, Space+drag, middle-mouse drag and
 * two-finger touch pinch. Returns cleanup (usable as a Svelte attachment).
 */
export function viewportInput(viewport: ViewportState, opts: ViewportInputOptions = {}) {
	return (node: HTMLElement) => {
		const local = (e: { clientX: number; clientY: number }) => {
			const r = node.getBoundingClientRect();
			return { x: e.clientX - r.left, y: e.clientY - r.top };
		};

		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			const unit = e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? node.clientHeight : 1;
			let dx = e.deltaX * unit;
			let dy = e.deltaY * unit;
			if (e.ctrlKey || e.metaKey) {
				// Trackpad pinch arrives as ctrl+wheel with small deltas.
				const d = Math.max(-MAX_ZOOM_DELTA, Math.min(MAX_ZOOM_DELTA, dy));
				viewport.zoomBy(Math.exp(-d * ZOOM_SPEED), local(e));
				return;
			}
			if (e.shiftKey && dx === 0) [dx, dy] = [dy, 0];
			viewport.panBy(-dx, -dy);
		};

		// --- Space / middle-mouse panning -------------------------------------------------------
		let spaceHeld = false;
		let panPointer: number | null = null;
		let last = { x: 0, y: 0 };
		const notify = () => opts.onPanningChange?.(panPointer !== null, spaceHeld);

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.code === 'Space' && !e.repeat && !isTypingTarget(e.target)) {
				e.preventDefault();
				spaceHeld = true;
				notify();
			}
		};
		const onKeyUp = (e: KeyboardEvent) => {
			if (e.code === 'Space') {
				spaceHeld = false;
				notify();
			}
		};
		const onBlur = () => {
			spaceHeld = false;
			notify();
		};

		// --- Touch pinch -------------------------------------------------------------------------
		const touches = new Map<number, { x: number; y: number }>();
		let pinch: { dist: number; mid: { x: number; y: number } } | null = null;
		const pinchState = () => {
			const [a, b] = [...touches.values()];
			if (!a || !b) return null;
			return {
				dist: Math.hypot(a.x - b.x, a.y - b.y),
				mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
			};
		};

		const onPointerDown = (e: PointerEvent) => {
			if (e.pointerType === 'touch') {
				touches.set(e.pointerId, local(e));
				if (touches.size === 2) {
					pinch = pinchState();
					e.stopPropagation();
				}
				return;
			}
			if (e.button === 1 || (e.button === 0 && spaceHeld)) {
				e.preventDefault();
				e.stopImmediatePropagation(); // tools (same node) must not see panning gestures
				panPointer = e.pointerId;
				last = local(e);
				node.setPointerCapture(e.pointerId);
				notify();
			}
		};

		const onPointerMove = (e: PointerEvent) => {
			if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
				touches.set(e.pointerId, local(e));
				const next = pinchState();
				if (pinch && next && touches.size === 2) {
					viewport.panBy(next.mid.x - pinch.mid.x, next.mid.y - pinch.mid.y);
					if (pinch.dist > 0) viewport.zoomBy(next.dist / pinch.dist, next.mid);
					pinch = next;
					e.stopPropagation();
				}
				return;
			}
			if (e.pointerId !== panPointer) return;
			const p = local(e);
			viewport.panBy(p.x - last.x, p.y - last.y);
			last = p;
		};

		const onPointerUp = (e: PointerEvent) => {
			if (e.pointerType === 'touch') {
				touches.delete(e.pointerId);
				if (touches.size < 2) pinch = null;
				return;
			}
			if (e.pointerId === panPointer) {
				panPointer = null;
				notify();
			}
		};

		// Middle-click autoscroll would fight our panning.
		const onAuxDown = (e: MouseEvent) => {
			if (e.button === 1) e.preventDefault();
		};

		node.addEventListener('wheel', onWheel, { passive: false });
		// Capture phase: panning takes priority over tools (step 11) on the same node.
		node.addEventListener('pointerdown', onPointerDown, { capture: true });
		node.addEventListener('pointermove', onPointerMove, { capture: true });
		node.addEventListener('pointerup', onPointerUp, { capture: true });
		node.addEventListener('pointercancel', onPointerUp, { capture: true });
		node.addEventListener('mousedown', onAuxDown);
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		window.addEventListener('blur', onBlur);

		return () => {
			node.removeEventListener('wheel', onWheel);
			node.removeEventListener('pointerdown', onPointerDown, { capture: true });
			node.removeEventListener('pointermove', onPointerMove, { capture: true });
			node.removeEventListener('pointerup', onPointerUp, { capture: true });
			node.removeEventListener('pointercancel', onPointerUp, { capture: true });
			node.removeEventListener('mousedown', onAuxDown);
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			window.removeEventListener('blur', onBlur);
		};
	};
}
