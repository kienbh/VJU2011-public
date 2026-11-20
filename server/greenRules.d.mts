export type GreenBin='organic'|'recycle'|'residual';
export type GreenState={version?:number;seed?:number};
export const RUBBISH:{name:string;bin:GreenBin;shape:string;why:string}[];
export function seededRandom(seed:number):()=>number;
export function greenConfig(state?:GreenState):{total:number;initial:number;interval:number;capacity:number};
export function greenItems(state?:GreenState):number[];
export function greenUnlockSeconds(state:GreenState,index:number):number;
