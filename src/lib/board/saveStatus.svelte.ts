import { toast } from 'svelte-sonner';
import type { BoardSaver } from '$lib/storage/boardSaver';

const TOAST_ID = 'save-failed';

/**
 * Whether the board's changes reach browser storage. A failure is shown in the top bar and as a
 * toast with "Retry", and leaving the page asks first while changes aren't saved.
 */
export class SaveStatus {
	failed = $state(false);
	retrying = $state(false);
	readonly #saver: BoardSaver;
	readonly #stop: () => void;
	readonly #onBeforeUnload = (e: BeforeUnloadEvent) => {
		if (this.failed) e.preventDefault();
	};

	constructor(saver: BoardSaver) {
		this.#saver = saver;
		this.failed = saver.state.kind === 'failed';
		const unsubscribe = saver.subscribe((state) => {
			this.failed = state.kind === 'failed';
			if (this.failed) this.#announce();
			else toast.dismiss(TOAST_ID);
		});
		window.addEventListener('beforeunload', this.#onBeforeUnload);
		this.#stop = () => {
			unsubscribe();
			window.removeEventListener('beforeunload', this.#onBeforeUnload);
			toast.dismiss(TOAST_ID);
		};
	}

	async retry(): Promise<void> {
		if (this.retrying) return;
		this.retrying = true;
		try {
			if (await this.#saver.retry()) toast.success('Changes saved');
			else this.#announce();
		} finally {
			this.retrying = false;
		}
	}

	#announce(): void {
		toast.error('Changes aren’t being saved', {
			id: TOAST_ID,
			description:
				'Browser storage may be full or unavailable. Free up space, then retry, or download a copy of the board.',
			duration: Number.POSITIVE_INFINITY,
			action: { label: 'Retry', onClick: () => void this.retry() }
		});
	}

	destroy(): void {
		this.#stop();
	}
}
