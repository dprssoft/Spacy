import { Extension, Mark, type Extensions } from '@tiptap/core';
import {
	ALIGNS,
	CUSTOM,
	customVar,
	FORMAT_MARKS,
	isChoice,
	isHexColor,
	type Align,
	type FormatMark
} from './formatOptions';

/**
 * A mark that holds one id from a fixed list (a color, a font…), rendered as a `data-*` attribute;
 * the color marks also take any `#rrggbb` value, carried by a CSS variable.
 */
function choiceMark(name: FormatMark) {
	const { attr, data } = FORMAT_MARKS[name];
	const cssVar = customVar(name);
	const read = (el: HTMLElement) => {
		const value = el.getAttribute(data);
		if (value === CUSTOM && cssVar) {
			const color = el.style.getPropertyValue(cssVar).trim().toLowerCase();
			return isHexColor(color) ? color : null;
		}
		return value !== CUSTOM && isChoice(name, value) ? value : null;
	};
	return Mark.create({
		name,
		// Outside bold, underline and strikethrough (default priority 100), so their lines take
		// the text color and size.
		priority: 150,
		addAttributes() {
			return {
				[attr]: {
					default: null,
					parseHTML: read,
					renderHTML: (attrs: Record<string, unknown>) => {
						const value = attrs[attr];
						if (!isChoice(name, value)) return {};
						return cssVar && isHexColor(value)
							? { [data]: CUSTOM, style: `${cssVar}: ${value}` }
							: { [data]: value };
					}
				}
			};
		},
		parseHTML() {
			return [
				{
					tag: `span[${data}]`,
					// One span may carry several of these marks.
					consuming: false,
					getAttrs: (el) => (read(el) ? null : false)
				}
			];
		},
		renderHTML({ HTMLAttributes }) {
			return ['span', HTMLAttributes, 0];
		}
	});
}

const isAlign = (v: unknown): v is Align => (ALIGNS as readonly unknown[]).includes(v);

/** Paragraph and heading alignment. Left is the default and isn't stored. */
const Alignment = Extension.create({
	name: 'alignment',
	addGlobalAttributes() {
		return [
			{
				types: ['paragraph', 'heading'],
				attributes: {
					align: {
						default: null,
						parseHTML: (el: HTMLElement) => {
							const value = el.getAttribute('data-align') ?? el.style.textAlign;
							return isAlign(value) && value !== 'left' ? value : null;
						},
						renderHTML: (attrs: Record<string, unknown>) =>
							isAlign(attrs.align) && attrs.align !== 'left' ? { 'data-align': attrs.align } : {}
					}
				}
			}
		];
	}
});

/** Text color, highlight, font, size and alignment (underline comes with the starter kit). */
export function formatExtensions(): Extensions {
	return [...(Object.keys(FORMAT_MARKS) as FormatMark[]).map(choiceMark), Alignment];
}
