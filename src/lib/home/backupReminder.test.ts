import { describe, expect, it } from 'vitest';
import { shouldShowBackupReminder } from './backupReminder';

const DAY = 24 * 60 * 60 * 1000;
const now = 100 * DAY;
const base = { boardCount: 3, lastBackupAt: null, dismissedAt: null, now };

describe('shouldShowBackupReminder', () => {
	it('shows with 3+ boards and no backup or dismissal', () => {
		expect(shouldShowBackupReminder(base)).toBe(true);
	});
	it('needs at least 3 boards', () => {
		expect(shouldShowBackupReminder({ ...base, boardCount: 2 })).toBe(false);
	});
	it('stays hidden for 14 days after a backup', () => {
		expect(shouldShowBackupReminder({ ...base, lastBackupAt: now - 13 * DAY })).toBe(false);
		expect(shouldShowBackupReminder({ ...base, lastBackupAt: now - 14 * DAY })).toBe(false);
		expect(shouldShowBackupReminder({ ...base, lastBackupAt: now - 15 * DAY })).toBe(true);
	});
	it('stays hidden for 7 days after "Later"', () => {
		expect(shouldShowBackupReminder({ ...base, dismissedAt: now - 6 * DAY })).toBe(false);
		expect(shouldShowBackupReminder({ ...base, dismissedAt: now - 8 * DAY })).toBe(true);
	});
	it('an old backup and a recent dismissal: hidden; both old: shown', () => {
		const old = now - 30 * DAY;
		expect(shouldShowBackupReminder({ ...base, lastBackupAt: old, dismissedAt: now - DAY })).toBe(
			false
		);
		expect(shouldShowBackupReminder({ ...base, lastBackupAt: old, dismissedAt: old })).toBe(true);
	});
});
