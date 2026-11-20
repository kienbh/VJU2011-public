import {tr} from '../i18n/index.ts';
import './sound.css';
import { SCALE, chordAt, melodyNote, stepInterval } from './timing';
import {createFireworkAudio} from './fireworkAudio';
import type {FireworkClock} from './fireworkCues';
import {createCampusAmbience,type Listener} from './campusAmbience';

/**
 * Procedural ambience with synthesized dog/cat effects and CC0 fireworks.
 * Public edition pet effects are synthesized locally.
 *
 * Browsers only allow audio after a user gesture, so the context is created lazily on the
 * first pointer or key press. Nothing here may throw into the render loop.
 */
/**
 * Procedural ambience with synthesized dog/cat effects and CC0 fireworks.
 * Public edition pet effects are synthesized locally.
 *
 * Browsers only allow audio after a user gesture, so the context is created lazily on the
 * first pointer or key press. Nothing here may throw into the render loop.
 */
export type SoundFrame = {
  /** Ground speed in metres per second. */
  /** Ground speed in metres per second. */
  speed: number;
  /** Player is walking the campus (not seated, not in a cinematic or a dialog). */
  /** Player is walking the campus (not seated, not in a cinematic or a dialog). */
  walking: boolean;
  /** Finale fireworks are on screen. */
  /** Finale fireworks are on screen. */
  finale: boolean;
  fireworks?: FireworkClock;
  /** Player position and camera forward direction for positional campus sounds. */
  /** Player position and camera forward direction for positional campus sounds. */
  listener?: Listener | null;
  /** Festival (evening) layer on: insects, frogs and plaza chatter may play. */
  /** Festival (evening) layer on: insects, frogs and plaza chatter may play. */
  festival?: boolean;
  /** Library reading room open: soft rain replaces outdoor ambience. */
  /** Library reading room open: soft rain replaces outdoor ambience. */
  library?: boolean;
};

export type Soundscape = {
  update(dt: number, frame: SoundFrame): void;
  kick(): void;
  chime(): void;
  pet(kind:'dog'|'cat'): void;
  /** Short recorded crowd cheer for the player's own goal. */
  /** Short recorded crowd cheer for the player's own goal. */
  cheer(): void;
  /** Campus event sound (splash, pour, clink, bell, page, goal, tea…), optionally positioned. */
  /** Campus event sound (splash, pour, clink, bell, page, goal, tea…), optionally positioned. */
  effect(name: string, at?: {x:number;z:number}): void;
  readonly muted: boolean;
};

const STORAGE_KEY = 'vju2011-sound';
const BEAT = 60 / 54 / 2; // one eighth note at a slow 54 bpm

export function createSoundscape({ showButton = true }: { showButton?: boolean } = {}): Soundscape {
  let ctx: AudioContext | null = null;
  let master: GainNode, music: GainNode, ambience: GainNode, effects: GainNode, echo: DelayNode;
  let noise: AudioBuffer;
  let muted = false;
  try { muted = localStorage.getItem(STORAGE_KEY) === 'off'; } catch { /* storage unavailable */ }

  let stepClock = 0, stepSide = 1;
  let nextBeat = 0, beatIndex = 0;
  let lastNote: number | null = null, lastNoteBeat = -99;
  let nextBird = 0;
  let fireworks:ReturnType<typeof createFireworkAudio>|null=null;
  let campus:ReturnType<typeof createCampusAmbience>|null=null;
  let petEpoch = 0, nextPet = 0;
  let cheerBuffer: Promise<AudioBuffer | null> | null = null, cheerSource: AudioBufferSourceNode | null = null, nextCheer = 0;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sound-toggle';
  const paint = () => {
    button.textContent = muted ? '🔇' : '🔊';
    button.setAttribute('aria-pressed', String(!muted));
    button.setAttribute('aria-label', muted ? tr('Bật âm thanh') : tr('Tắt âm thanh'));
    button.title = muted ? tr('Bật âm thanh') : tr('Tắt âm thanh');
  };
  paint();
  button.addEventListener('click', () => {
    muted = !muted;
    try { localStorage.setItem(STORAGE_KEY, muted ? 'off' : 'on'); } catch { /* storage unavailable */ }
    paint();
    if (!muted) unlock();
    applyMaster();
  });
  if (showButton) document.body.append(button);

  function applyMaster() {
    if (muted || document.hidden) {
      fireworks?.stop();
      campus?.stop();
      petEpoch++;
      try { cheerSource?.stop(); } catch { /* already ended */ }
      cheerSource = null;
    }
    if (!ctx) return;
    const target = muted || document.hidden ? 0 : 0.9;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(target, ctx.currentTime, 0.15);
  }

  function unlock() {
    if (muted) return;
    try {
      if (!ctx) build();
      if (ctx!.state === 'suspended') void ctx!.resume().catch(() => { /* retry on the next user gesture */ });
    } catch { ctx = null; }
  }

  function build() {
    ctx = new AudioContext();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14; limiter.ratio.value = 8; limiter.attack.value = 0.004; limiter.release.value = 0.25;
    master = ctx.createGain(); master.gain.value = 0;
    master.connect(limiter).connect(ctx.destination);
    music = ctx.createGain(); music.gain.value = 0.5; music.connect(master);
    ambience = ctx.createGain(); ambience.gain.value = 0.55; ambience.connect(master);
    effects = ctx.createGain(); effects.gain.value = 1; effects.connect(master);
    fireworks=createFireworkAudio(ctx,effects);
    campus=createCampusAmbience(ctx,effects);

    // A soft feedback echo gives the plucked melody some space.
    echo = ctx.createDelay(1); echo.delayTime.value = BEAT * 3;
    const feedback = ctx.createGain(); feedback.gain.value = 0.16;
    const echoTone = ctx.createBiquadFilter(); echoTone.type = 'lowpass'; echoTone.frequency.value = 1400;
    echo.connect(echoTone).connect(feedback).connect(echo);
    echoTone.connect(music);

    // Two seconds of white noise, reused by wind and footsteps.
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    // Evening breeze: looping noise through a slowly drifting low-pass filter.
    const wind = ctx.createBufferSource(); wind.buffer = noise; wind.loop = true;
    const windTone = ctx.createBiquadFilter(); windTone.type = 'lowpass'; windTone.frequency.value = 420; windTone.Q.value = 0.4;
    const windGain = ctx.createGain(); windGain.gain.value = 0.085;
    const drift = ctx.createOscillator(); drift.frequency.value = 0.07;
    const driftDepth = ctx.createGain(); driftDepth.gain.value = 190;
    drift.connect(driftDepth).connect(windTone.frequency);
    wind.connect(windTone).connect(windGain).connect(ambience);
    wind.start(); drift.start();

    nextBeat = ctx.currentTime + 0.6;
    nextBird = ctx.currentTime + 3;
    applyMaster();
  }

  /** One enveloped oscillator note. */
  /** One enveloped oscillator note. */
  function tone(type: OscillatorType, from: number, to: number, start: number, length: number, peak: number, out: AudioNode, attack = 0.008) {
    const osc = ctx!.createOscillator(), gain = ctx!.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + length);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain).connect(out);
    osc.start(start); osc.stop(start + length + 0.05);
    return gain;
  }

  /** One enveloped, filtered slice of the shared noise buffer. */
  /** One enveloped, filtered slice of the shared noise buffer. */
  function burst(filter: BiquadFilterType, frequency: number, q: number, start: number, length: number, peak: number, out: AudioNode) {
    const source = ctx!.createBufferSource(); source.buffer = noise;
    const shape = ctx!.createBiquadFilter(); shape.type = filter; shape.frequency.value = frequency; shape.Q.value = q;
    const gain = ctx!.createGain();
    gain.gain.setValueAtTime(peak, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    source.connect(shape).connect(gain).connect(out);
    source.start(start, Math.random() * 1.5, length + 0.05);
  }

  function panned(pan: number) {
    const node = ctx!.createStereoPanner(); node.pan.value = pan; node.connect(effects);
    return node;
  }

  function footstep(at: number) {
    stepSide = -stepSide;
    const out = panned(stepSide * 0.12);
    const body = 150 + Math.random() * 50 + (stepSide > 0 ? 18 : 0);
    burst('bandpass', body, 1.1, at, 0.09, 0.34, out);           // heel
    burst('highpass', 2400 + Math.random() * 900, 0.5, at + 0.012, 0.035, 0.05, out); // grit
  }

  function bird(at: number) {
    const out = ctx!.createStereoPanner(); out.pan.value = Math.random() * 1.6 - 0.8; out.connect(ambience);
    const base = 2300 + Math.random() * 1500, calls = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < calls; i++) {
      const start = at + i * (0.11 + Math.random() * 0.05);
      tone('sine', base * (1 + Math.random() * 0.12), base * (1.25 + Math.random() * 0.2), start, 0.085, 0.035, out, 0.012);
    }
  }

  function musicBeat(at: number) {
    const slot = beatIndex % 8, bar = Math.floor(beatIndex / 8);
    const chord = chordAt(bar);
    if (slot === 0) {
      // Warm pad: root and fifth swell in slowly and fade out before the next bar begins.
      for (const [frequency, level] of [[chord.root, 0.08], [chord.fifth, 0.045], [chord.root * 2.004, 0.022]] as const) {
        tone('sine', frequency, frequency, at, BEAT * 8, level, music, BEAT * 3.5);
      }
    }
    // One voice at a time: leave at least three eighths between notes so tails never pile up.
    const index = beatIndex - lastNoteBeat >= 3 ? melodyNote(bar, slot, Math.random, lastNote) : null;
    if (index !== null) {
      lastNote = index; lastNoteBeat = beatIndex;
      const note = SCALE[index];
      // Soft plucked voice: rounded attack, decay finished before the next note may start.
      const tint = ctx!.createBiquadFilter(); tint.type = 'lowpass'; tint.frequency.value = 1900;
      const send = ctx!.createGain(); send.gain.value = 0.35;
      tint.connect(music); tint.connect(send); send.connect(echo);
      tone('triangle', note, note, at, BEAT * 2.8, slot % 4 === 0 ? 0.11 : 0.085, tint, 0.03);
      tone('sine', note * 2, note * 2, at, 0.5, 0.014, tint, 0.03);
    }
    beatIndex++;
  }

  function update(dt: number, frame: SoundFrame) {
    try {
      fireworks?.update(frame.fireworks??null,!!ctx&&!muted&&!document.hidden&&ctx.state==='running');
      if (!ctx || muted || document.hidden || ctx.state !== 'running') return;
      const now = ctx.currentTime;
      campus?.update(dt,{listener:frame.listener??null,festival:!!frame.festival,library:!!frame.library,finale:frame.finale||!!frame.fireworks});

      const interval = frame.walking ? stepInterval(frame.speed) : null;
      if (interval === null) stepClock = 0.2; // first step lands soon after starting to move
      else { stepClock += dt; if (stepClock >= interval) { stepClock = 0; footstep(now + 0.01); } }

      // Schedule slightly ahead so timing survives uneven frames; resync after a long pause.
      if (nextBeat < now - 0.5) nextBeat = now + 0.1;
      while (nextBeat < now + 0.25) { musicBeat(nextBeat); nextBeat += BEAT; }

      if (!frame.finale && !frame.fireworks && now >= nextBird) {
        bird(now + 0.02);
        nextBird = now + 4 + Math.random() * 9;
      }
      // Let the fireworks be heard over the music.
      music.gain.setTargetAtTime(frame.finale || frame.fireworks ? 0.3 : 0.5, now, 0.6);
    } catch { /* never break the render loop for sound */ }
  }

  function kick() {
    if (!ctx || muted) return;
    // Recorded kick when loaded (preloaded near the pitch); otherwise the synthetic thump.
    if (ctx.state === 'running' && campus?.play('kick')) return;
    try {
      const now = ctx.currentTime + 0.01, out = panned(0);
      tone('sine', 170, 52, now, 0.16, 0.7, out, 0.003);
      burst('bandpass', 900, 0.8, now, 0.05, 0.25, out);
    } catch { /* ignore */ }
  }

  // Public edition uses original synthesized effects; no stock pet recordings.
  function pet(kind:'dog'|'cat') {
    if (!ctx || muted || document.hidden || ctx.state !== 'running' || performance.now() < nextPet) return;
    syntheticPet(kind);
    nextPet = performance.now() + 1200;
  }

  async function playCheer() {
    if (!ctx || muted || document.hidden || ctx.state !== 'running' || cheerSource || performance.now() < nextCheer) return;
    const audioContext = ctx, epoch = petEpoch;
    nextCheer = performance.now() + 3000;
    try {
      cheerBuffer ??= (async () => {
        const controller = new AbortController(), timeout = window.setTimeout(() => controller.abort(), 2500);
        try { const r = await fetch('/assets/audio/cheer/goal.mp3', { signal: controller.signal }); return r.ok ? await audioContext.decodeAudioData(await r.arrayBuffer()) : null; }
        catch { return null; } finally { window.clearTimeout(timeout); }
      })();
      const buffer = await cheerBuffer;
      // Same guard as pets: a late download never plays after mute, hiding the tab or a new context.
      if (epoch !== petEpoch || ctx !== audioContext || muted || document.hidden || audioContext.state !== 'running') return;
      if (!buffer) { chime(); return; }
      const source = audioContext.createBufferSource(), gain = audioContext.createGain();
      source.buffer = buffer; gain.gain.value = 0.45; source.connect(gain).connect(effects); cheerSource = source;
      source.onended = () => { source.disconnect(); gain.disconnect(); if (cheerSource === source) cheerSource = null; };
      source.start();
    } catch { /* audio restrictions must never break play */ }
  }

  function cheer() { void playCheer(); }

  function effect(name: string, at?: {x:number;z:number}) {
    if (!ctx || muted || document.hidden || ctx.state !== 'running' || !campus) return;
    try {
      // A goal: ball into the net, then the referee's whistle.
      if (name === 'goal') { campus.event('net', {at}); campus.event('whistle', {delay: .45}); return; }
      // Sitting down to tea: pour, then the cup set down.
      if (name === 'tea') { campus.event('pour', {at}); campus.event('clink', {at, delay: 2.6}); return; }
      campus.event(name, {at});
    } catch { /* never break play for sound */ }
  }

  function syntheticPet(kind:'dog'|'cat') {
    if (!ctx || muted || document.hidden || ctx.state !== 'running') return;
    try {
      const at=ctx.currentTime+.01,out=panned(0);
      // Short stylised calls, routed through the existing mute/master gain.
      if(kind==='dog')for(const delay of [0,.24]){
        tone('triangle',240,95,at+delay,.16,.28,out,.008);
        burst('bandpass',580,1.4,at+delay,.13,.2,out);
      }
      else{
        const formant=ctx.createBiquadFilter();formant.type='bandpass';formant.frequency.value=1100;formant.Q.value=.7;formant.connect(out);
        tone('sawtooth',480,750,at,.12,.10,formant,.025);
        tone('sawtooth',750,340,at+.11,.43,.10,formant,.025);
      }
    } catch { /* audio restrictions must never break interaction */ }
  }

  function chime() {
    if (!ctx || muted) return;
    try {
      const now = ctx.currentTime + 0.01;
      [587.33, 739.99, 880.0].forEach((frequency, i) => tone('sine', frequency, frequency, now + i * 0.11, 0.9, 0.11, effects, 0.006));
    } catch { /* ignore */ }
  }

  function click() {
    if (!ctx || muted || ctx.state !== 'running') return;
    try { tone('sine', 1250, 900, ctx.currentTime + 0.005, 0.05, 0.045, effects, 0.003); } catch { /* ignore */ }
  }

  for (const type of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(type, unlock, { passive: true });
  document.addEventListener('click', event => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, summary, [role="button"]') && !target.closest('.sound-toggle')) click();
  }, { passive: true });
  document.addEventListener('visibilitychange', applyMaster);

  return { update, kick, chime, pet, cheer, effect, get muted() { return muted; } };
}
