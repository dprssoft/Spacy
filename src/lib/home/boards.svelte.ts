import * as boardsRepo from '$lib/storage/boardsRepo';
import { onBoardsChanged } from '$lib/storage/channels';
import type { BoardFilter, BoardMeta, BoardSort } from '$lib/storage/types';

/** Reactive board list for the start page. Call `start()` to subscribe; it returns cleanup. */
export class BoardsQuery {
	items = $state<BoardMeta[]>([]);
	loading = $state(true);
	filter = $state<BoardFilter>('recent');
	sort = $state<BoardSort>('opened');
	query = $state('');

	#request = 0;

	start(): () => void {
		const off = onBoardsChanged(() => void this.refresh());
		const stopEffect = $effect.root(() => {
			$effect(() => {
				// Re-run when any of these change.
				void [this.filter, this.sort, this.query];
				void this.refresh();
			});
		});
		return () => {
			off();
			stopEffect();
		};
	}

	async refresh(): Promise<void> {
		const request = ++this.#request;
		const items = await boardsRepo.list({
			filter: this.filter,
			sort: this.sort,
			query: this.query
		});
		// A newer refresh started while we waited: its result wins.
		if (request !== this.#request) return;
		this.items = items;
		this.loading = false;
	}
}
