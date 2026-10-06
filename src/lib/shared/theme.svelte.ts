import { getPref, setPref } from './localPrefs';
import { isPaletteId, PALETTES, type PaletteId } from './palettes';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];

function readMode(): ThemeMode {
	const stored = getPref<unknown>('theme', 'system');
	return MODES.includes(stored as ThemeMode) ? (stored as ThemeMode) : 'system';
}

function readPalette(): PaletteId {
	const stored = getPref<unknown>('palette', 'default');
	return isPaletteId(stored) ? stored : 'default';
}

class ThemeState {
	// The defaults until `init()`: the prerendered start page hydrates with them (the stored
	// choice is already on <html>, set by the inline script in app.html before first paint).
	mode = $state<ThemeMode>('system');
	systemDark = $state(false);
	resolved: ResolvedTheme = $derived(
		this.mode === 'system' ? (this.systemDark ? 'dark' : 'light') : this.mode
	);
	palette = $state<PaletteId>('default');
	/** Changes whenever the colors do: for code that reads CSS variables once per theme. */
	readonly key = $derived(`${this.resolved}:${this.palette}`);

	/** Loads the stored choice, tracks the OS preference and keeps `html[data-theme]` in sync. */
	init(): () => void {
		this.mode = readMode();
		this.palette = readPalette();
		const media =
			typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
		const onChange = () => (this.systemDark = media?.matches ?? false);
		onChange();
		media?.addEventListener('change', onChange);

		const stopEffect = $effect.root(() => {
			$effect(() => {
				const root = document.documentElement;
				root.dataset.theme = this.resolved;
				if (this.palette === 'default') delete root.dataset.palette;
				else root.dataset.palette = this.palette;
				const p = PALETTES.find((x) => x.id === this.palette) ?? PALETTES[0]!;
				document
					.querySelector('meta[name="theme-color"]')
					?.setAttribute('content', p.accent[this.resolved]);
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

	setPalette(id: PaletteId): void {
		this.palette = id;
		setPref('palette', id);
	}

	cycle(): void {
		this.set(MODES[(MODES.indexOf(this.mode) + 1) % MODES.length] ?? 'system');
	}
}

export const theme = new ThemeState();
