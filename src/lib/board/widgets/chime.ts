import { readMediaPrefs } from '../media/mediaPrefs';

let audio: AudioContext | null = null;

/**
 * A short two-note chime (no asset), at the personal media volume (silent when media is muted).
 * Does nothing where Web Audio isn't available.
 */
export function chime(): void {
	const { muted, volume } = readMediaPrefs();
	if (muted || volume === 0) return;
	try {
		audio ??= new AudioContext();
		const ctx = audio;
		const start = ctx.currentTime + 0.02;
		[880, 1318.5].forEach((freq, i) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			const t = start + i * 0.18;
			osc.type = 'sine';
			osc.frequency.value = freq;
			gain.gain.setValueAtTime(0.0001, t);
			gain.gain.exponentialRampToValueAtTime(0.25 * volume, t + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
			osc.connect(gain).connect(ctx.destination);
			osc.start(t);
			osc.stop(t + 0.65);
		});
	} catch {
		// No sound is fine: the face still shows "Time's up".
	}
}
