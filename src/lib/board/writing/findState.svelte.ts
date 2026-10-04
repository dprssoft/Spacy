/** The find and replace panel (one board at a time). */
class FindState {
	open = $state(false);
	/** Bumps to focus the query field again (Mod+F while open). */
	focusTick = $state(0);
	show(): void {
		this.open = true;
		this.focusTick++;
	}
}
export const findState = new FindState();
