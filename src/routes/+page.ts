// The start page is prerendered at build time, so its HTML paints before the app's JavaScript has
// loaded; the browser then hydrates it. Its first render must not read browser state (localStorage,
// IndexedDB, the URL's query): that is applied after hydration. Every other route stays client-only.
export const ssr = true;
export const prerender = true;
