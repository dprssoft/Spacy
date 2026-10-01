import { getPref, setPref } from '$lib/shared/localPrefs';

/** Per-user canvas preferences (stored in localStorage, shared by all boards). */
export class BoardPrefs {
	grid = $state(getPref<boolean>('grid', true) !== false);
	snapToGrid = $state(getPref<boolean>('snap', false) === true);

	setGrid(on: boolean): void {
		this.grid = on;
		setPref('grid', on);
	}

	setSnapToGrid(on: boolean): void {
		this.snapToGrid = on;
		setPref('snap', on);
	}
}
