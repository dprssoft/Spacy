export const OPEN_MARK = 'board-open-start';
export const OPEN_MEASURE = 'board-open';

/**
 * Records how long a board took from route mount to its first painted elements
 * (`performance.getEntriesByName('board-open')`); logged in dev. Call once after the first render.
 */
export function measureBoardOpen(): void {
	try {
		if (performance.getEntriesByName(OPEN_MARK).length === 0) return;
		const m = performance.measure(OPEN_MEASURE, OPEN_MARK);
		performance.clearMarks(OPEN_MARK);
		if (import.meta.env.DEV) console.debug(`Board open: ${Math.round(m.duration)} ms`);
	} catch {
		// Timing is best-effort.
	}
}
