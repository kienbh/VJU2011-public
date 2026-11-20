// Implemented from Dat's written specification, not imported student source.
export const SHOW_WORDS=['VJU','20/11','幸せ','Happy'] as const;
export const SHOW_PALETTES=[['#ff718e','#6bdcff','#ffd770'],['#ad8cff','#7dffd1','#ff994d'],['#ff7bd5','#b5e8ff','#fff2aa']];
export function showPhase(time:number){const cycle=Math.floor(Math.max(0,time)/50),phase=Math.max(0,time)%50;return {cycle,phase,active:phase<30,word:Math.min(3,Math.floor(phase/7.5))};}
export function advanceShow(time:number,dt:number,allowed:boolean,reduced:boolean){return allowed&&!reduced?time+Math.min(.1,Math.max(0,dt)):time;}
export function particleBudget(value:number){return Math.max(4800,Math.min(11500,Math.floor(value)));}
export function sideBurst(index:number){return (index%2?1:-1)*(58+(index%3)*12);}
