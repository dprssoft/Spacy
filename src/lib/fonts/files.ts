// The bundled font files: Latin, Latin Extended and Cyrillic subsets of each family (the browser
// downloads a subset only when text needs it). All are OFL-1.1, except Roboto Slab (Apache-2.0).
import caveatCyrillic from '@fontsource-variable/caveat/files/caveat-cyrillic-wght-normal.woff2?url';
import caveatLatinExt from '@fontsource-variable/caveat/files/caveat-latin-ext-wght-normal.woff2?url';
import caveatLatin from '@fontsource-variable/caveat/files/caveat-latin-wght-normal.woff2?url';
import comfortaaCyrillic from '@fontsource-variable/comfortaa/files/comfortaa-cyrillic-wght-normal.woff2?url';
import comfortaaLatinExt from '@fontsource-variable/comfortaa/files/comfortaa-latin-ext-wght-normal.woff2?url';
import comfortaaLatin from '@fontsource-variable/comfortaa/files/comfortaa-latin-wght-normal.woff2?url';
import interCyrillic from '@fontsource-variable/inter/files/inter-cyrillic-wght-normal.woff2?url';
import interLatinExt from '@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2?url';
import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
import jetbrainsCyrillic from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-cyrillic-wght-normal.woff2?url';
import jetbrainsLatinExt from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-ext-wght-normal.woff2?url';
import jetbrainsLatin from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url';
import loraCyrillic from '@fontsource-variable/lora/files/lora-cyrillic-wght-normal.woff2?url';
import loraLatinExt from '@fontsource-variable/lora/files/lora-latin-ext-wght-normal.woff2?url';
import loraLatin from '@fontsource-variable/lora/files/lora-latin-wght-normal.woff2?url';
import montserratCyrillic from '@fontsource-variable/montserrat/files/montserrat-cyrillic-wght-normal.woff2?url';
import montserratLatinExt from '@fontsource-variable/montserrat/files/montserrat-latin-ext-wght-normal.woff2?url';
import montserratLatin from '@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2?url';
import oswaldCyrillic from '@fontsource-variable/oswald/files/oswald-cyrillic-wght-normal.woff2?url';
import oswaldLatinExt from '@fontsource-variable/oswald/files/oswald-latin-ext-wght-normal.woff2?url';
import oswaldLatin from '@fontsource-variable/oswald/files/oswald-latin-wght-normal.woff2?url';
import playfairCyrillic from '@fontsource-variable/playfair-display/files/playfair-display-cyrillic-wght-normal.woff2?url';
import playfairLatinExt from '@fontsource-variable/playfair-display/files/playfair-display-latin-ext-wght-normal.woff2?url';
import playfairLatin from '@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2?url';
import robotoSlabCyrillic from '@fontsource-variable/roboto-slab/files/roboto-slab-cyrillic-wght-normal.woff2?url';
import robotoSlabLatinExt from '@fontsource-variable/roboto-slab/files/roboto-slab-latin-ext-wght-normal.woff2?url';
import robotoSlabLatin from '@fontsource-variable/roboto-slab/files/roboto-slab-latin-wght-normal.woff2?url';
import pacificoCyrillic from '@fontsource/pacifico/files/pacifico-cyrillic-400-normal.woff2?url';
import pacificoLatinExt from '@fontsource/pacifico/files/pacifico-latin-ext-400-normal.woff2?url';
import pacificoLatin from '@fontsource/pacifico/files/pacifico-latin-400-normal.woff2?url';

// Google Fonts' subset ranges, as used by these files.
export const UNICODE_RANGES = {
	latin:
		'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
	'latin-ext':
		'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
	cyrillic: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116'
} as const;
export type Subset = keyof typeof UNICODE_RANGES;

/** Font id → file URL per subset. */
export const FONT_FILES: Record<string, Record<Subset, string>> = {
	inter: { latin: interLatin, 'latin-ext': interLatinExt, cyrillic: interCyrillic },
	montserrat: {
		latin: montserratLatin,
		'latin-ext': montserratLatinExt,
		cyrillic: montserratCyrillic
	},
	oswald: { latin: oswaldLatin, 'latin-ext': oswaldLatinExt, cyrillic: oswaldCyrillic },
	comfortaa: { latin: comfortaaLatin, 'latin-ext': comfortaaLatinExt, cyrillic: comfortaaCyrillic },
	lora: { latin: loraLatin, 'latin-ext': loraLatinExt, cyrillic: loraCyrillic },
	'roboto-slab': {
		latin: robotoSlabLatin,
		'latin-ext': robotoSlabLatinExt,
		cyrillic: robotoSlabCyrillic
	},
	playfair: { latin: playfairLatin, 'latin-ext': playfairLatinExt, cyrillic: playfairCyrillic },
	'jetbrains-mono': {
		latin: jetbrainsLatin,
		'latin-ext': jetbrainsLatinExt,
		cyrillic: jetbrainsCyrillic
	},
	caveat: { latin: caveatLatin, 'latin-ext': caveatLatinExt, cyrillic: caveatCyrillic },
	pacifico: { latin: pacificoLatin, 'latin-ext': pacificoLatinExt, cyrillic: pacificoCyrillic }
};
