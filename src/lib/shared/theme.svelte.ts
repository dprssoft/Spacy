import { getPref, setPref } from './localPrefs';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];

function readMode(): ThemeMode {
	const stored = getPref<unknown>('theme', 'system');
	return MODES.includes(stored as ThemeMode) ? (stored as ThemeMode) : 'system';
}

class ThemeState {
	mode = $state<ThemeMode>(readMode());
	systemDark = $state(false);
	resolved: ResolvedTheme = $derived(
		this.mode === 'system' ? (this.systemDark ? 'dark' : 'light') : this.mode
	);

	/** Tracks the OS preference and keeps `html[data-theme]` in sync. Returns cleanup. */
	init(): () => void {
		const media =
			typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
		const onChange = () => (this.systemDark = media?.matches ?? false);
		onChange();
		media?.addEventListener('change', onChange);

		const stopEffect = $effect.root(() => {
			$effect(() => {
				document.documentElement.dataset.theme = this.resolved;
			});
		});

		return () => {
			media?.removeEventListener('change', onChange);
			stopEffect();
		};
	}

	set(mode: ThemeMode): void {
		this.mode = mode;
		setPref('theme', mode);
	}

	cycle(): void {
		this.set(MODES[(MODES.indexOf(this.mode) + 1) % MODES.length] ?? 'system');
	}
}

export const theme = new ThemeState();
