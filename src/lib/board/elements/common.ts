import { FONT_FAMILY, FONT_SIZE_PX, LINE_HEIGHT, RADIUS_PX } from '$lib/model/defaults';
import type { BaseElement, Point, Rect, Style } from '$lib/model/types';
import { pointInRotatedRect, rotatedAABB } from '../engine/geometry';

export const boxAABB = (el: BaseElement): Rect => rotatedAABB(el, el.rotation);

export const boxHitTest = (el: BaseElement, p: Point, tol: number): boolean =>
	pointInRotatedRect(p, el, el.rotation, tol);

/** Wrapper-level CSS for opacity and shadow. */
export function styleToCss(style: Style): string {
	const parts = [`opacity:${style.opacity}`];
	if (style.shadow) parts.push('filter:drop-shadow(0 2px 6px rgb(0 0 0 / 0.15))');
	return parts.join(';');
}

export function fontToCss(font: Style['font']): string {
	return [
		`font-family:${FONT_FAMILY}`,
		`font-size:${FONT_SIZE_PX[font.size]}px`,
		`line-height:${LINE_HEIGHT}`,
		`font-weight:${font.bold ? 700 : 400}`,
		`font-style:${font.italic ? 'italic' : 'normal'}`,
		`color:${font.color}`,
		`text-align:${font.align === 'l' ? 'left' : font.align === 'r' ? 'right' : 'center'}`
	].join(';');
}

/** CSS justify-content for a vertical flex column. */
export function valignToJustify(valign: Style['font']['valign']): string {
	return valign === 't' ? 'flex-start' : valign === 'b' ? 'flex-end' : 'center';
}

/** SVG stroke-dasharray for a dash style, scaled with the stroke width. */
export function dashArray(dash: Style['dash'], width: number): string | undefined {
	if (dash === 'dashed') return `${4 * width} ${3 * width}`;
	if (dash === 'dotted') return `0 ${2 * width}`;
	return undefined;
}

/** Effective fill color: none → transparent, semi → 25% of the fill color. */
export function fillColor(style: Style): string {
	if (style.fillStyle === 'none' || style.fill === 'transparent') return 'transparent';
	if (style.fillStyle === 'semi') return `color-mix(in srgb, ${style.fill} 25%, transparent)`;
	return style.fill;
}

/** The default dark ink. On the canvas it follows the theme so it stays visible on a dark board. */
export const DEFAULT_INK = '#1e1e1e';

/**
 * Render-time color for strokes and text drawn directly on the canvas: the default dark ink
 * becomes `--ink` (light in dark mode). Never written to data; exports use the authored color.
 */
export function ink(color: string): string {
	return color.toLowerCase() === DEFAULT_INK ? 'var(--ink)' : color;
}

/** A font whose default-ink text follows the theme (`onCanvas`: it isn't on an opaque fill). */
export function inkFont(font: Style['font'], onCanvas = true): Style['font'] {
	return onCanvas ? { ...font, color: ink(font.color) } : font;
}

/** True when a shape's text sits on the canvas background rather than on its own solid fill. */
export function seeThrough(style: Style): boolean {
	return style.fillStyle !== 'solid' || style.fill === 'transparent';
}

export const radiusPx = (style: Style): number => RADIUS_PX[style.radius];
