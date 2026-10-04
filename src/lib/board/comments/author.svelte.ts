import { getPref, setPref } from '$lib/shared/localPrefs';

/** The name comments are signed with: asked the first time you comment, per browser. */
class CommentAuthor {
	name = $state(getPref<unknown>('commentAuthor', '') as string);

	constructor() {
		if (typeof this.name !== 'string') this.name = '';
	}

	set(name: string): void {
		this.name = name.trim().slice(0, 100);
		setPref('commentAuthor', this.name);
	}
}
export const commentAuthor = new CommentAuthor();
