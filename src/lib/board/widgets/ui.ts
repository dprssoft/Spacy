import type { Component } from 'svelte';
import TimerIcon from '@lucide/svelte/icons/timer';
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

export const WIDGET_ICONS: Record<string, typeof TimerIcon> = { timer: TimerIcon };
export const WIDGET_SETTINGS: Record<string, Component<WidgetSettingsProps>> = {
	timer: TimerSettings
};
