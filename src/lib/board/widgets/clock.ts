// Widget state stores absolute times, so every tab and peer shows the same countdown as long as
// their clocks agree. A clock found to be off (against the web server's Date header) is corrected.

/** The Date header has whole seconds: smaller differences are measurement noise. */
const MIN_SKEW_MS = 2000;

let skew = 0;

/** Milliseconds this clock is ahead (+) of the server; null leaves it unknown (no correction). */
export function setClockSkew(ms: number | null): void {
	skew = ms !== null && Math.abs(ms) >= MIN_SKEW_MS ? ms : 0;
}

export const now = (): number => Date.now() - skew;
