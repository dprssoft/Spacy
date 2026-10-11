import { FONT_FAMILY, RADIUS_PX } from '$lib/model/defaults';
import type { WidgetElement } from '$lib/model/types';
import type { Glyph, WidgetAction, WidgetFace } from './kinds';
import { widgetView } from './kinds';
import { fitDesign } from './layout';
import { escapeXml, fitText, n } from './svg';

// The one drawing of a widget, as SVG markup in its box's coordinates: the live view, exports and
// thumbnails all use it, so they always agree.

export const MUTED = '#868e96';
const TRACK = '#e9ecef';
const BUTTON = '#f1f3f5';
const BUTTON_HOVER = '#dee2e6';

// Lucide-style icons in a 24 × 24 box, stroked.
const ICONS: Record<Exclude<Glyph, { text: string }>, string> = {
	play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
	pause:
		'<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>',
	reset:
		'<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 3v5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
};

function button(a: WidgetAction, face: WidgetFace, ink: string, hover: boolean): string {
	const { x, y, w, h } = a.rect;
	const fill = a.primary ? face.accent : hover ? BUTTON_HOVER : BUTTON;
	const color = a.primary ? '#ffffff' : ink;
	const bg = `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="10" fill="${fill}"${a.primary && hover && !a.disabled ? ' fill-opacity="0.85"' : ''}/>`;
	const cx = x + w / 2;
	const cy = y + h / 2;
	const glyph =
		typeof a.glyph === 'object'
			? `<text x="${n(cx)}" y="${n(cy + 5)}" text-anchor="middle" font-size="14" font-weight="600" fill="${color}">${escapeXml(a.glyph.text)}</text>`
			: `<g transform="translate(${n(cx - 9)} ${n(cy - 9)}) scale(0.75)" color="${color}" style="color:${color}">${ICONS[a.glyph]}</g>`;
	return a.disabled ? `<g opacity="0.4">${bg}${glyph}</g>` : bg + glyph;
}

/** The face and buttons in the design space. */
function design(
	face: WidgetFace,
	art: string | null,
	actions: WidgetAction[],
	d: { w: number; h: number },
	ink: string,
	hover: string | null
): string {
	const buttons = actions.map((a) => button(a, face, ink, hover === a.id)).join('');
	if (art !== null) return art + buttons;
	const contentH = actions.length > 0 ? d.h - 56 : d.h;
	const cx = d.w / 2;
	const cy = contentH / 2 + 4;
	let out = '';
	if (face.ring !== null) {
		const r = Math.min(d.w, contentH) / 2 - 16;
		const c = 2 * Math.PI * r;
		const f = Math.min(1, Math.max(0, face.ring));
		out +=
			`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="none" stroke="${TRACK}" stroke-width="8"/>` +
			`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="none" stroke="${face.accent}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${n(c * f)} ${n(c)}" transform="rotate(-90 ${n(cx)} ${n(cy)})"${f === 0 ? ' stroke-opacity="0"' : ''}/>`;
	}
	const headSize = face.headline.length > 6 ? 28 : 36;
	out +=
		`<text x="${n(cx)}" y="${n(cy + headSize * 0.32)}" text-anchor="middle" font-size="${headSize}" font-weight="700" fill="${face.alert ? face.accent : ink}" style="font-variant-numeric:tabular-nums">${escapeXml(face.headline)}</text>` +
		`<text x="${n(cx)}" y="${n(cy + headSize * 0.32 + 22)}" text-anchor="middle" font-size="12" fill="${MUTED}">${escapeXml(fitText(face.caption, 12, d.w * 0.55))}</text>`;
	return out + buttons;
}

/** SVG markup of a widget in its box's coordinates (0,0 – w,h). */
export function widgetSvg(
	el: WidgetElement,
	now: number,
	hover: string | null = null,
	motion = true
): string {
	const s = el.style;
	const { face, art, actions, design: d } = widgetView(el, now, motion);
	const inset = s.stroke === 'transparent' ? 0 : s.strokeWidth / 2;
	const card = `<rect x="${n(inset)}" y="${n(inset)}" width="${n(Math.max(0, el.w - 2 * inset))}" height="${n(Math.max(0, el.h - 2 * inset))}" rx="${RADIUS_PX[s.radius]}" fill="${escapeXml(s.fill === 'transparent' ? 'none' : s.fill)}"${s.stroke === 'transparent' ? '' : ` stroke="${escapeXml(s.stroke)}" stroke-width="${s.strokeWidth}"`}/>`;
	const { scale, dx, dy } = fitDesign(d, el);
	return (
		card +
		`<g transform="translate(${n(dx)} ${n(dy)}) scale(${n(scale)})">${design(face, art, actions, d, s.font.color, hover)}</g>`
	);
}

/** A whole `<svg>` element for the live view. */
export function widgetSvgDocument(
	el: WidgetElement,
	now: number,
	hover: string | null,
	motion: boolean
): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(el.w)}" height="${n(el.h)}" viewBox="0 0 ${n(el.w)} ${n(el.h)}" font-family="${escapeXml(FONT_FAMILY)}" style="display:block;overflow:visible">${widgetSvg(el, now, hover, motion)}</svg>`;
}
