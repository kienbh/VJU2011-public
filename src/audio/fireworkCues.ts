import {FINALE_PLAN,FINALE_WORD_BURSTS,FINALE_LOGO} from '../festival/finalePlan.ts';
import {sideBurst} from '../festival/fireworksShow.ts';
export type FireworkClock={mode:'finale'|'show';time:number}|null;
export type FireworkCue={at:number;kind:'launch'|'burst';pan:number;variant:number;gain?:number};
const pan=(x:number)=>Math.max(-.75,Math.min(.75,x/128));
/** Follow the visual timeline; discard missed events after stalls, seeks or unmuting. */
export function fireworkCues(previous:FireworkClock,current:FireworkClock):FireworkCue[]{
 if(!current||!Number.isFinite(current.time))return [];
 const from=previous?.mode===current.mode?previous.time:current.time-.035,to=current.time;
 if(to<from||to-from>.25)return [];
 const cues:FireworkCue[]=[];
 const add=(at:number,kind:FireworkCue['kind'],pan:number,variant:number,gain?:number)=>{if(at>from&&at<=to)cues.push(gain===undefined?{at,kind,pan,variant}:{at,kind,pan,variant,gain});};
 // Same plan as the renderer: launch leaves the ground point, the report follows the visible burst by its distance delay.
 if(current.mode==='finale')for(const shell of FINALE_PLAN){
  add(shell.launch,'launch',pan(shell.ground[0]),0,.1+.02*(2-shell.depth)/2);
  add(shell.burst+shell.soundDelay,'burst',pan(shell.wide[0]),shell.variant,shell.gain);
 }
 // The burst whose sparks write each word sits just behind the lettering, centre stage.
 if(current.mode==='finale'){FINALE_WORD_BURSTS.forEach((at,i)=>add(at+.09,'burst',0,i%2,.34));add(FINALE_LOGO.burst+.11,'burst',pan(FINALE_LOGO.wide[0]),0,.36);}
 else{
  // Optional mode has four repeating visible bursts, no launch animation, 30s on / 20s off.
  const cycle=Math.floor(to/50);
  for(let c=Math.max(0,cycle-1);c<=cycle;c++)for(let b=0;b<4;b++)for(let n=0;n<10;n++){
   const birth=n*3.4-b*.72;if(birth<0||birth+.12>=30)continue;
   add(c*50+birth+.12,'burst',sideBurst(b)/110,(n+b)%3);
  }
 }
 return cues.sort((a,b)=>a.at-b.at);
}
