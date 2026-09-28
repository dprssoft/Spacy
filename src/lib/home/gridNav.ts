/** Index of the item that should receive focus after `key`, in a grid with `cols` columns. */
export function nextIndex(current: number, key: string, cols: number, count: number): number {
	if (count === 0) return -1;
	const c = Math.max(1, cols);
	const clamp = (i: number) => Math.min(count - 1, Math.max(0, i));
	switch (key) {
		case 'ArrowRight':
			return clamp(current + 1);
		case 'ArrowLeft':
			return clamp(current - 1);
		case 'ArrowDown':
			return current + c < count ? current + c : current;
		case 'ArrowUp':
			return current - c >= 0 ? current - c : current;
		case 'Home':
			return 0;
		case 'End':
			return count - 1;
		default:
			return current;
	}
}

/** Number of columns a CSS grid currently renders. */
export function gridColumns(grid: HTMLElement): number {
	const template = getComputedStyle(grid).gridTemplateColumns;
	return template && template !== 'none' ? template.trim().split(/\s+/).length : 1;
}
