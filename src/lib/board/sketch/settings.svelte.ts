import { getPref, setPref } from '$lib/shared/localPrefs';
import { BRUSHES, MAX_SIZE, MIN_SIZE, type BrushId } from './brushes';

const PREF = 'sketch';
type Saved = { brush: BrushId; size: number; color: string };
const DEFAULTS: Saved = { brush: 'pen', size: 6, color: '#1e1e1e' };

/** The sketch tool's brush, size and color (remembered), and the sketch being drawn into. */
export class SketchSettings {
	brush = $state<BrushId>(DEFAULTS.brush);
	size = $state(DEFAULTS.size);
	color = $state(DEFAULTS.color);
	/** The sketch new strokes are added to; null = the next stroke starts a new sketch. */
	activeId = $state<string | null>(null);

	constructor() {
		const saved = getPref<Partial<Saved> | null>(PREF, null);
		if (saved && BRUSHES.some((b) => b.id === saved.brush)) this.brush = saved.brush!;
		if (typeof saved?.size === 'number') this.size = clampSize(saved.size);
		if (typeof saved?.color === 'string' && /^#[0-9a-f]{6}$/i.test(saved.color))
			this.color = saved.color;
	}

	set(patch: Partial<Saved>): void {
		if (patch.brush) this.brush = patch.brush;
		if (patch.size !== undefined) this.size = clampSize(patch.size);
		if (patch.color) this.color = patch.color;
		setPref(PREF, { brush: this.brush, size: this.size, color: this.color } satisfies Saved);
	}
}

const clampSize = (n: number) => Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(n)));
