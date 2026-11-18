import { isoDate, type DeadlineConfig } from '$lib/board/widgets/deadline/deadline';
import { DEFAULT_PROGRESS, type ProgressConfig } from '$lib/board/widgets/progress/progress';
import type { StatusConfig } from '$lib/board/widgets/status/status';

// Widget configs for template builders.

/** A deadline `days` from today, at the end of the day. */
export function deadlineIn(days: number, label: string, now = Date.now()): DeadlineConfig {
	const t = new Date(now);
	return {
		date: isoDate(new Date(t.getFullYear(), t.getMonth(), t.getDate() + days)),
		time: null,
		label
	};
}

export const manualProgress = (color: string): ProgressConfig => ({ ...DEFAULT_PROGRESS, color });

export const checklistProgress = (cardId: string): ProgressConfig => ({
	...DEFAULT_PROGRESS,
	source: 'checklist',
	cardId
});

export const statusChip = (options: [string, string][]): StatusConfig => ({
	options: options.map(([label, color]) => ({ label, color })),
	value: 0
});
