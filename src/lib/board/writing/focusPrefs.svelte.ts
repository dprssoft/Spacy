import { getPref, setPref } from '$lib/shared/localPrefs';

/** Optional writing aids in focus mode (all off by default), remembered per browser. */
export interface FocusPrefs {
	typewriter: boolean;
	focusParagraph: boolean;
	hideUi: boolean;
	width: 'narrow' | 'medium' | 'wide';
	font: 'document' | 'serif';
	size: 's' | 'm' | 'l';
}

export const FOCUS_DEFAULTS: FocusPrefs = {
	typewriter: false,
	focusParagraph: false,
	hideUi: false,
	width: 'medium',
	font: 'document',
	size: 'm'
};

export const WIDTH_CH = { narrow: 60, medium: 72, wide: 90 } as const;
export const SIZE_PX = { s: 16, m: 18, l: 21 } as const;

function read(): FocusPrefs {
	const raw = getPref<Partial<FocusPrefs> | null>('focus', null);
	const v = raw && typeof raw === 'object' ? raw : {};
	const pick = <K extends keyof FocusPrefs>(k: K, ok: (x: unknown) => boolean) =>
		(ok(v[k]) ? v[k] : FOCUS_DEFAULTS[k]) as FocusPrefs[K];
	const bool = (x: unknown) => typeof x === 'boolean';
	return {
		typewriter: pick('typewriter', bool),
		focusParagraph: pick('focusParagraph', bool),
		hideUi: pick('hideUi', bool),
		width: pick('width', (x) => x === 'narrow' || x === 'medium' || x === 'wide'),
		font: pick('font', (x) => x === 'document' || x === 'serif'),
		size: pick('size', (x) => x === 's' || x === 'm' || x === 'l')
	};
}

class FocusPrefsState {
	value = $state<FocusPrefs>(read());
	set(patch: Partial<FocusPrefs>): void {
		this.value = { ...this.value, ...patch };
		setPref('focus', this.value);
	}
}

export const focusPrefs = new FocusPrefsState();
