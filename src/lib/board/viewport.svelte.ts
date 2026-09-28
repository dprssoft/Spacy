import type { Point, Rect } from '$lib/model/types';
import {
	centeredOrigin,
	clampZoom,
	fitRect,
	panBy,
	zoomAt,
	type Size,
	type Viewport
} from './engine/viewport';

function prefersReducedMotion(): boolean {
	return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Reactive pan/zoom state of a board's canvas. Math lives in engine/viewport.ts. */
export class ViewportState {
	x = $state(0);
	y = $state(0);
	zoom = $state(1);
	size = $state<Size>({ w: 0, h: 0 });

	#animation = 0;

	get vp(): Viewport {
		return { x: this.x, y: this.y, zoom: this.zoom };
	}

	get center(): Point {
		return { x: this.size.w / 2, y: this.size.h / 2 };
	}

	set(vp: Viewport): void {
		cancelAnimationFrame(this.#animation);
		this.x = vp.x;
		this.y = vp.y;
		this.zoom = clampZoom(vp.zoom);
	}

	zoomAt(screenPoint: Point, zoom: number): void {
		this.set(zoomAt(this.vp, screenPoint, zoom));
	}

	zoomBy(factor: number, around: Point = this.center): void {
		this.zoomAt(around, this.zoom * factor);
	}

	panBy(dx: number, dy: number): void {
		this.set(panBy(this.vp, dx, dy));
	}

	/** Fits `rect` on screen (never above 100%); `null` resets to the origin at 100%. */
	fit(rect: Rect | null, animate = true): void {
		const target = rect ? fitRect(rect, this.size) : centeredOrigin(this.size);
		if (animate) this.animateTo(target);
		else this.set(target);
	}

	/** 100% zoom, keeping the screen center fixed. */
	reset100(): void {
		this.animateTo(zoomAt(this.vp, this.center, 1));
	}

	animateTo(target: Viewport, ms = 250): void {
		cancelAnimationFrame(this.#animation);
		if (prefersReducedMotion() || ms <= 0) return this.set(target);
		const from = this.vp;
		const c = this.center;
		// World points at the screen center, before and after.
		const fromC = { x: (c.x - from.x) / from.zoom, y: (c.y - from.y) / from.zoom };
		const toC = { x: (c.x - target.x) / target.zoom, y: (c.y - target.y) / target.zoom };
		const start = performance.now();
		const step = (now: number) => {
			const t = Math.min(1, (now - start) / ms);
			const e = 1 - (1 - t) ** 3; // ease-out cubic
			// Geometric zoom feels even at every scale; the centered world point moves in a line.
			const zoom = from.zoom * (target.zoom / from.zoom) ** e;
			const wx = fromC.x + (toC.x - fromC.x) * e;
			const wy = fromC.y + (toC.y - fromC.y) * e;
			this.x = c.x - wx * zoom;
			this.y = c.y - wy * zoom;
			this.zoom = zoom;
			if (t < 1) this.#animation = requestAnimationFrame(step);
			else this.set(target);
		};
		this.#animation = requestAnimationFrame(step);
	}

	destroy(): void {
		cancelAnimationFrame(this.#animation);
	}
}
