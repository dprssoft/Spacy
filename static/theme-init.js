// Applies the theme before first paint to avoid a flash (see src/lib/shared/theme.svelte.ts).
// A separate file, not an inline script, so the Content-Security-Policy can forbid inline code.
try {
	var mode = JSON.parse(localStorage.getItem('smthng:theme') || '"system"');
	var dark =
		mode === 'dark' || (mode !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
	document.documentElement.dataset.theme = dark ? 'dark' : 'light';
	var palette = JSON.parse(localStorage.getItem('smthng:palette') || '"default"');
	if (/^(terracotta|graphite|petrol|plum|moss)$/.test(palette))
		document.documentElement.dataset.palette = palette;
} catch {
	document.documentElement.dataset.theme = 'light';
}
