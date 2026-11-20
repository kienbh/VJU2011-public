import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Transpile the TypeScript helper in memory so the test needs no build step.
const source = readFileSync(new URL('./timing.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { stepInterval, melodyNote, chordAt, SCALE, CHORDS } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

test('no footsteps while standing or on invalid speed', () => {
  for (const speed of [0, 0.3, -1, NaN, Infinity]) assert.equal(stepInterval(speed), null);
});

test('footsteps get quicker with speed and stay within a natural range', () => {
  const slow = stepInterval(1.5), fast = stepInterval(5), sprint = stepInterval(50);
  assert.ok(slow > fast);
  assert.ok(slow <= 0.62 && fast >= 0.3);
  assert.equal(sprint, 0.3);
});

test('chords cycle and tolerate negative or fractional bars', () => {
  assert.equal(chordAt(0), CHORDS[0]);
  assert.equal(chordAt(5.7), CHORDS[1]);
  assert.equal(chordAt(-1), CHORDS[3]);
});

test('melody is sparse, stays on chord tones and moves by small steps', () => {
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let notes = 0, rests = 0, previous = null;
  for (let bar = 0; bar < 60; bar++) for (let slot = 0; slot < 8; slot++) {
    const index = melodyNote(bar, slot, random, previous);
    if (index === null) { rests++; continue; }
    notes++;
    assert.ok(chordAt(bar).tones.includes(index));
    assert.ok(SCALE[index] > 0);
    if (previous !== null) {
      const reachable = chordAt(bar).tones.some(tone => tone !== previous && Math.abs(tone - previous) <= 2);
      if (reachable) assert.ok(Math.abs(index - previous) <= 2 && index !== previous, `leap from ${previous} to ${index}`);
    }
    previous = index;
  }
  assert.ok(notes > 60, `too few notes: ${notes}`);
  assert.ok(rests > notes * 2, `melody should be mostly rests, got ${notes} notes / ${rests} rests`);
});
