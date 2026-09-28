const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const formatters = new Map<string, Intl.RelativeTimeFormat>();

function formatter(locale: string | undefined): Intl.RelativeTimeFormat {
	const key = locale ?? '';
	let f = formatters.get(key);
	if (!f) {
		f = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
		formatters.set(key, f);
	}
	return f;
}

/** "just now", "5 minutes ago", "yesterday", "3 weeks ago"… for past (or near-future) times. */
export function relativeTime(ts: number, now = Date.now(), locale?: string): string {
	const diff = ts - now; // negative = past
	const abs = Math.abs(diff);
	if (abs < 45 * SECOND) return 'just now';
	const f = formatter(locale);
	const [unit, size]: [Intl.RelativeTimeFormatUnit, number] =
		abs < 45 * MINUTE
			? ['minute', MINUTE]
			: abs < 22 * HOUR
				? ['hour', HOUR]
				: abs < WEEK
					? ['day', DAY]
					: abs < 5 * WEEK
						? ['week', WEEK]
						: abs < YEAR
							? ['month', MONTH]
							: ['year', YEAR];
	return f.format(Math.round(diff / size) || Math.sign(diff), unit);
}
