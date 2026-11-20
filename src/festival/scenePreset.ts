export type ScenePreset='day'|'dusk';
export function nextDusk(current:number,target:ScenePreset,dt:number,reduced:boolean){const end=target==='dusk'?1:0;if(reduced)return end;const step=Math.min(.1,Math.max(0,dt))/2;return current<end?Math.min(end,current+step):Math.max(end,current-step);}
export function readScene(value:unknown):ScenePreset{return value==='dusk'?'dusk':'day';}
