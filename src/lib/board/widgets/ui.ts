import type { Component } from 'svelte';
import Coins from '@lucide/svelte/icons/coins';
import Dices from '@lucide/svelte/icons/dices';
import FerrisWheel from '@lucide/svelte/icons/ferris-wheel';
import Shuffle from '@lucide/svelte/icons/shuffle';
import TimerIcon from '@lucide/svelte/icons/timer';
import CalendarClock from '@lucide/svelte/icons/calendar-clock';
import ChartNoAxesGantt from '@lucide/svelte/icons/chart-no-axes-gantt';
import CircleDot from '@lucide/svelte/icons/circle-dot';
import DeadlineSettings from './deadline/DeadlineSettings.svelte';
import ProgressSettings from './progress/ProgressSettings.svelte';
import StatusSettings from './status/StatusSettings.svelte';
import CoinSettings from './coin/CoinSettings.svelte';
import DiceSettings from './dice/DiceSettings.svelte';
import RandomizerSettings from './randomizer/RandomizerSettings.svelte';
import WheelSettings from './wheel/WheelSettings.svelte';
import TimerSettings from './timer/TimerSettings.svelte';
import type { WidgetElement } from '$lib/model/types';

// The UI side of each widget kind: its menu icon and its settings. Kinds without an entry here
// still work; they just have no settings beyond the title.

export interface WidgetSettingsProps {
	el: WidgetElement;
	/** Writes a new config (one undo step per change). */
	setConfig(config: unknown): void;
	disabled: boolean;
}

export const WIDGET_ICONS: Record<string, typeof TimerIcon> = {
	timer: TimerIcon,
	wheel: FerrisWheel,
	randomizer: Shuffle,
	dice: Dices,
	coin: Coins,
	progress: ChartNoAxesGantt,
	status: CircleDot,
	deadline: CalendarClock
};
export const WIDGET_SETTINGS: Record<string, Component<WidgetSettingsProps>> = {
	timer: TimerSettings,
	wheel: WheelSettings,
	randomizer: RandomizerSettings,
	dice: DiceSettings,
	coin: CoinSettings,
	progress: ProgressSettings,
	status: StatusSettings,
	deadline: DeadlineSettings
};
