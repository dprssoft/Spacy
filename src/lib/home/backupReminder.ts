const DAY = 24 * 60 * 60 * 1000;
export const MIN_BOARDS = 3;
export const BACKUP_MAX_AGE = 14 * DAY;
export const DISMISS_FOR = 7 * DAY;
export const DISMISSED_PREF = 'backupReminderDismissedAt';

/**
 * Remind once there's something to lose (3+ boards), the last backup is missing or older than
 * 14 days, and the reminder wasn't dismissed in the last 7 days.
 */
export function shouldShowBackupReminder(o: {
	boardCount: number;
	lastBackupAt: number | null;
	dismissedAt: number | null;
	now: number;
}): boolean {
	if (o.boardCount < MIN_BOARDS) return false;
	if (o.lastBackupAt !== null && o.now - o.lastBackupAt <= BACKUP_MAX_AGE) return false;
	if (o.dismissedAt !== null && o.now - o.dismissedAt <= DISMISS_FOR) return false;
	return true;
}
