import { templatePreview } from '$lib/templates/preview';
import { templates } from '$lib/templates';

// Runs at build time only (the page is prerendered): the featured templates' previews ship in the
// HTML, so the start page never loads the renderer to draw them.
export async function load() {
	const featured = templates.filter((t) => t.featured);
	const previews = await Promise.all(featured.map((t) => templatePreview(t)));
	return { templatePreviews: Object.fromEntries(featured.map((t, i) => [t.id, previews[i]!])) };
}
