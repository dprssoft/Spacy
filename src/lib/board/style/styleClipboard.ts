import { styleSchema } from '$lib/model/schema';
import type { Style } from '$lib/model/types';
import { getPref, setPref } from '$lib/shared/localPrefs';
import type { BoardContext } from '../context';
import { selectedElements } from '../commands/edit';
import { applyStyle } from './applyStyle';
import { STYLE_OPTIONS } from './options';
import { pickStyle } from './pickStyle';

interface CopiedStyle {
	style: Style;
	/** Sticky color, when copied from a sticky. */
	color?: string;
}

/** Copies the first selected element's look (kept across boards and reloads). */
export function copyStyle(ctx: BoardContext): boolean {
	const el = selectedElements(ctx)[0];
	if (!el) return false;
	const copied: CopiedStyle = {
		style: el.style,
		...(el.type === 'sticky' ? { color: el.color } : {})
	};
	setPref('copiedStyle', copied);
	return true;
}

export function readCopiedStyle(): CopiedStyle | null {
	const raw = getPref<Partial<CopiedStyle> | null>('copiedStyle', null);
	const parsed = styleSchema.safeParse(raw?.style);
	if (!parsed.success) return null;
	return { style: parsed.data, ...(typeof raw?.color === 'string' ? { color: raw.color } : {}) };
}

/** Pastes the copied look onto the selection: each element takes only what applies to its type. */
export function pasteStyle(ctx: BoardContext): boolean {
	const copied = readCopiedStyle();
	if (!copied) return false;
	const targets = selectedElements(ctx).filter((el) => !el.locked);
	if (targets.length === 0) return false;
	ctx.undo.stopCapturing();
	for (const el of targets) {
		const options = new Set(STYLE_OPTIONS[el.type]);
		applyStyle(
			ctx,
			[el.id],
			{
				style: pickStyle(copied.style, options),
				...(copied.color && el.type === 'sticky' ? { color: copied.color } : {})
			},
			{ continuous: true }
		);
	}
	ctx.undo.stopCapturing();
	return true;
}
