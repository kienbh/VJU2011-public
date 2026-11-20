export const FOOTBALL:{x:number;z:number;ground:number;radius:number;goalXs:readonly [number,number];goal:{width:number;height:number;depth:number;post:number}};
export type BallFrame={revision:number;phase:'ready'|'shooting'|'rebound'|'goal';shotId:string|null;shooter:string|null;startedAt:number;duration:number;goalX:number;direction:number[];end:number[];goals:number;scored:boolean;blockedBy:string|null;blockedAt:number|null;bounceStart:number[];bounceVelocity:number[];resetAt:number;at:number;position:number[]};
export type BallPlayer={id:string;x:number;y:number;z:number;heading:number;state:string;updated:number};
export function shotDirection(p:{x:number;z:number},heading:number):number[];
export function sampleFootball(s:BallFrame,time:number):number[];
export function bodyIntersection(a:number[],b:number[],p:BallPlayer):number|null;
export function createFootballWorld():{kick(p:BallPlayer,time:number,id:string):boolean;advance(time:number,players:BallPlayer[]):void;snapshot():BallFrame};
