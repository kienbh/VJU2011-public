/** Pure timing helpers for the soundscape, kept free of Web Audio so they can be unit tested. */

/** Seconds between footsteps for a ground speed in metres per second; null when standing still. */
export function stepInterval(speed: number): number | null {
  if (!Number.isFinite(speed) || speed < 0.6) return null;
  return Math.min(0.62, Math.max(0.3, 2.6 / speed));
}

/** D major pentatonic, two octaves, in Hz. */
export const SCALE = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25, 739.99, 880.0];

/** Four-bar progression: root frequency and the scale degrees that sound consonant over it. */
export const CHORDS: ReadonlyArray<{ root: number; fifth: number; tones: number[] }> = [
  { root: 146.83, fifth: 220.0, tones: [0, 2, 3, 5, 7] }, // D
  { root: 123.47, fifth: 185.0, tones: [1, 2, 4, 6, 7] }, // Bm
  { root: 98.0, fifth: 146.83, tones: [0, 1, 4, 5, 6] }, // G
  { root: 110.0, fifth: 164.81, tones: [1, 3, 4, 6, 8] }, // A
];

export const chordAt = (bar: number) => CHORDS[((Math.floor(bar) % CHORDS.length) + CHORDS.length) % CHORDS.length];

/**
 * Melody choice for one eighth-note slot: an index into SCALE, or null for a rest.
 * Notes are sparse and move by small steps from `previous` so the line sounds calm and connected.
 * `random` is injected so the choice is reproducible in tests.
 */
export function melodyNote(bar: number, slot: number, random: () => number, previous: number | null = null): number | null {
  const strong = slot % 4 === 0;
  if (random() > (strong ? 0.6 : 0.16)) return null;
  const tones = chordAt(bar).tones;
  if (previous === null) return tones[Math.floor(random() * tones.length) % tones.length];
  const near = tones.filter(tone => tone !== previous && Math.abs(tone - previous) <= 2);
  const pool = near.length ? near : tones;
  return pool[Math.floor(random() * pool.length) % pool.length];
}
