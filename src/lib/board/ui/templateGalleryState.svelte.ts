/** Open state of the board's template gallery (one board is open at a time). */
class TemplateGalleryState {
	open = $state(false);
}

export const templateGallery = new TemplateGalleryState();
