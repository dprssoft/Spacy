import type { Style } from '$lib/model/types';
import type { StylePatch } from './applyStyle';
import type { StyleOption } from './options';

/** The parts of `style` that the given options control (e.g. to paste a style onto another type). */
export function pickStyle(style: Style, options: ReadonlySet<StyleOption>): StylePatch {
	const out: StylePatch = {};
	const font: Partial<Style['font']> = {};
	if (options.has('fill')) out.fill = style.fill;
	if (options.has('fillStyle')) out.fillStyle = style.fillStyle;
	if (options.has('stroke')) out.stroke = style.stroke;
	if (options.has('strokeWidth')) out.strokeWidth = style.strokeWidth;
	if (options.has('dash')) out.dash = style.dash;
	if (options.has('radius')) out.radius = style.radius;
	if (options.has('shadow')) out.shadow = style.shadow;
	if (options.has('opacity')) out.opacity = style.opacity;
	if (options.has('fontSize')) font.size = style.font.size;
	if (options.has('fontStyle')) {
		font.bold = style.font.bold;
		font.italic = style.font.italic;
	}
	if (options.has('textColor')) font.color = style.font.color;
	if (options.has('align')) font.align = style.font.align;
	if (options.has('valign')) font.valign = style.font.valign;
	if (Object.keys(font).length) out.font = font;
	return out;
}
