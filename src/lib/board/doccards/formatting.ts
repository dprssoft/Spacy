import { Extension, Mark, type Extensions } from '@tiptap/core';
import { ALIGNS, FORMAT_MARKS, isChoice, type Align, type FormatMark } from './formatOptions';

/** A mark that holds one id from a fixed list (a color, a font…), rendered as a `data-*` attribute. */
function choiceMark(name: FormatMark) {
	const { attr, data } = FORMAT_MARKS[name];
	const read = (el: HTMLElement) => {
		const value = el.getAttribute(data);
		return isChoice(name, value) ? value : null;
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
					renderHTML: (attrs: Record<string, unknown>) =>
						isChoice(name, attrs[attr]) ? { [data]: attrs[attr] } : {}
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
