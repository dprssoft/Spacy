import { getPref, setPref } from '$lib/shared/localPrefs';

/** Personal playback settings (this browser only, never on the board). */
export interface MediaPrefs {
	volume: number;
	muted: boolean;
	rate: number;
	/** Starting one media pauses the others. */
	oneAtATime: boolean;
}

const DEFAULTS: MediaPrefs = { volume: 1, muted: false, rate: 1, oneAtATime: true };
export const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export function readMediaPrefs(): MediaPrefs {
	const raw = getPref<Partial<MediaPrefs> | null>('media', null);
	const v = raw && typeof raw === 'object' ? raw : {};
	return {
		volume:
			typeof v.volume === 'number' && v.volume >= 0 && v.volume <= 1 ? v.volume : DEFAULTS.volume,
		muted: typeof v.muted === 'boolean' ? v.muted : DEFAULTS.muted,
		rate: RATES.includes(v.rate as (typeof RATES)[number]) ? (v.rate as number) : DEFAULTS.rate,
		oneAtATime: typeof v.oneAtATime === 'boolean' ? v.oneAtATime : DEFAULTS.oneAtATime
	};
}

export function writeMediaPrefs(patch: Partial<MediaPrefs>): void {
	setPref('media', { ...readMediaPrefs(), ...patch });
}
