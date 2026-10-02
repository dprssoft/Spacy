import { getPref, setPref } from '$lib/shared/localPrefs';

const ONBOARDED = 'onboarded';

/** Help UI state shared by the help menu, the `?` shortcut and the onboarding tips. */
class HelpState {
	shortcutsOpen = $state(false);
	aboutOpen = $state(false);
	/** Index of the onboarding tip being shown, or null. */
	tip = $state<number | null>(null);

	/** Shows the tips on the first board ever opened in this browser. */
	startIfFirstRun(): void {
		if (getPref<boolean>(ONBOARDED, false) !== true) this.tip = 0;
	}

	showTips(): void {
		this.tip = 0;
	}

	/** Closes the tips for good (finished or skipped). */
	finishTips(): void {
		this.tip = null;
		setPref(ONBOARDED, true);
	}
}

export const help = new HelpState();
