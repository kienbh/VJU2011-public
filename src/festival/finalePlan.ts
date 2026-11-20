/** Finale interpretation of Dat's written concept: colour + halo, hearts and a clear text zone.
 * One timeline drives the renderer and the audio cues: launch, burst, centre, depth, kind, radius, life. */
export const FINALE_SECONDS=30;
export const FINALE_WORDS=['VJU','20/11','幸せ','Happy','20.11'] as const;
export function finaleWord(time:number){return Math.min(4,Math.floor(Math.max(0,time)/6));}

/** 0 peony, 1 heart, 2 ring, 3 willow (gold, hanging), 4 chrysanthemum (gold spark tails). */
export type FinaleKind=0|1|2|3|4;
export const FINALE_KIND_NAMES=['peony','heart','ring','willow','chrysanthemum'] as const;
/** Burst time, wide x/y, kind, size 0-2, depth 0 near / 1 mid / 2 far.
 * Acts follow the words: single shells, a build with pairs, a short rest, layered heights, rest, climax and falling gold. */
const SCORE:[number,number,number,FinaleKind,0|1|2,0|1|2][]=[
  [1.5,-62,92,0,1,1],[2.7,58,100,0,1,1],[3.9,4,118,4,2,2],[5.0,-88,68,0,0,0],[5.3,90,72,0,0,0],
  [6.8,2,116,3,2,2],[7.7,-70,96,1,1,1],[8.3,68,108,0,1,1],[9.0,92,70,2,0,0],[9.6,-40,122,4,1,2],[10.3,-94,64,0,0,0],[10.5,96,66,0,0,0],[11.2,30,120,0,1,2],
  [12.9,72,96,1,1,1],[13.4,-70,94,1,1,1],[14.2,0,124,0,2,2],[14.8,-84,82,4,1,1],[15.2,84,86,4,1,1],[16.0,-50,112,3,1,2],[16.4,48,108,3,1,2],[17.1,2,104,2,1,1],[17.5,-96,62,0,0,0],
  [18.6,96,64,0,0,0],[19.0,-62,100,0,1,1],[19.4,56,84,4,1,1],[20.1,-92,74,2,0,0],[20.5,92,76,2,0,0],[21.0,2,120,1,2,2],[21.7,-80,90,0,1,1],[22.0,74,80,0,1,1],[22.3,-30,118,4,1,2],[22.9,34,116,4,1,2],[23.2,0,96,0,1,1],
  [24.7,-92,70,0,0,0],[24.95,92,72,0,0,0],[25.2,-58,104,4,1,1],[25.4,52,86,4,1,1],[25.65,0,124,0,2,2],[25.85,-86,88,1,1,1],[26.0,84,72,1,1,1],[26.2,-30,116,0,1,2],[26.35,30,116,0,1,2],[26.5,-100,62,2,0,0],[26.6,100,62,2,0,0],
  [26.95,-60,110,3,2,1],[27.0,2,122,3,2,2],[27.05,56,94,3,2,1],
];
export const FINALE_SHELLS=SCORE.length;
const STARS=[165,112,96,130,150],LIFE=[2.2,1.9,1.9,2.9,2.6],DEPTH=[-40,-52,-66];
/** Deterministic 0..1 hash so variation is seeded per shell/star and never re-rolled per frame. */
export function finaleHash(a:number,b=0){const x=Math.sin(a*127.1+b*311.7+.5)*43758.5453;return x-Math.floor(x);}
export type FinaleShell={index:number;seed:number;kind:FinaleKind;launch:number;flight:number;burst:number;life:number;
  wide:[number,number];tall:[number,number];ground:[number,number];z:number;depth:number;radius:number;stars:number;
  soundDelay:number;gain:number;variant:number;size:0|1|2};
export function finaleShell(index:number):FinaleShell{
  const [burst,x,y,kind,size,depth]=SCORE[index],seed=finaleHash(index,7);
  // Gravity-limited ascent: higher shells take longer; ends at zero vertical speed.
  const flight=.9+Math.max(0,y-60)/65*.45,z=DEPTH[depth];
  // Keep the on-screen size of far shells close to near ones; perspective still reads as depth.
  const radius=[21,29,37][size]*(1+(-z/52-1)*.6);
  const tall:[number,number]=[Math.max(-23,Math.min(23,x*.24)),66+(y-60)*.85];
  const ground:[number,number]=[x*.85+(seed-.5)*12,tall[0]*.8+(seed-.5)*4];
  return {index,seed,kind,launch:burst-flight,flight,burst,life:LIFE[kind],wide:[x,y],tall,ground,z,depth,radius,
    stars:Math.round(STARS[kind]*[.7,1,1.25][size]),
    // Perceptual distance cue (scene units are not calibrated metres): farther shells sound later and softer.
    soundDelay:[.1,.14,.2][depth],gain:.4*[.75,1,1.15][size]*[1.05,1,.8][depth],
    variant:kind===3?2:kind===4?(index%2?2:1):index%2,size};
}
/** Each word is written by the sparks of one burst at the word's start (see finaleLettering). */
export const FINALE_WORD_BURSTS=[.15,6,12,18,24];
/** The round VJU emblem is drawn by sparks in the upper-right corner and holds to the end. Right-side shells after it stay lower. */
export const FINALE_LOGO={burst:19.6,wide:[82,88] as [number,number],tall:[0,96] as [number,number],z:-30,radius:24};
export const FINALE_PLAN=Array.from({length:FINALE_SHELLS},(_,i)=>finaleShell(i));
/** Rocket + flash per shell, then every star. */
export const FINALE_PARTICLES=FINALE_PLAN.reduce((n,s)=>n+s.stars+2,0);
/** Graphics policy budget (4800 economy … 11500 beautiful) → stars drawn; interleaved so every shell survives. */
export function finaleBudget(value:number){
  const limit=Number.isFinite(value)?value:4800;
  return Math.round(FINALE_PARTICLES*Math.min(1,Math.max(.55,limit/11500)));
}
export function finaleHalo(value:number){return Number.isFinite(value)&&value>4800;}
