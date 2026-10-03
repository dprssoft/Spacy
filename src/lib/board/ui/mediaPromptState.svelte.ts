/** Open state of the "Media link" popover (opened from the toolbar or the phone's Insert menu). */
class MediaPromptState {
	open = $state(false);
}

export const mediaPrompt = new MediaPromptState();
