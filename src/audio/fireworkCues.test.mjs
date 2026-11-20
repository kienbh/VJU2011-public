import test from 'node:test';import assert from 'node:assert/strict';
import {fireworkCues} from './fireworkCues.ts';
import {FINALE_SHELLS,FINALE_PLAN,FINALE_WORD_BURSTS,FINALE_LOGO} from '../festival/finalePlan.ts';
const clock=(time,mode='finale')=>({time,mode});
test('each finale shell has one launch at lift-off and a report after its visible burst',()=>{
 let previous=clock(0),cues=[];
 for(let i=1;i<=3000;i++){const current=clock(i/100);cues.push(...fireworkCues(previous,current));previous=current;}
 assert.equal(cues.length,FINALE_SHELLS*2+FINALE_WORD_BURSTS.length+1);
 assert(cues.some(c=>c.kind==='burst'&&Math.abs(c.at-FINALE_LOGO.burst-.11)<1e-8&&c.pan>0),'emblem burst heard on the right');
 for(const at of FINALE_WORD_BURSTS)assert(cues.some(c=>c.kind==='burst'&&c.pan===0&&Math.abs(c.at-at-.09)<1e-8),'each word-writing burst is heard');
 for(const s of FINALE_PLAN){
  assert(cues.some(c=>c.kind==='launch'&&c.at===s.launch));
  const burst=cues.find(c=>c.kind==='burst'&&Math.abs(c.at-s.burst-s.soundDelay)<1e-8);assert(burst);
  assert(burst.at>s.burst&&burst.at-s.burst<=.25,'report never precedes the flash');assert.equal(burst.gain,s.gain);
 }
 assert(cues.every(c=>Math.abs(c.pan)<=.75&&c.gain>0&&c.gain<=.5));assert.equal(new Set(cues.filter(c=>c.kind==='burst').map(c=>c.variant)).size,3);
 assert(cues.every(c=>['launch','burst'].includes(c.kind)),'finale contains only fireworks, no audience reactions');
});
test('same timestamp, stalls, seeking and missing timeline do not replay a backlog',()=>{
 assert.deepEqual(fireworkCues(clock(.16),clock(.16)),[]);
 assert.deepEqual(fireworkCues(clock(1),clock(10)),[]);
 assert.deepEqual(fireworkCues(clock(20),clock(0)),[]);
 assert.deepEqual(fireworkCues(clock(1),null),[]);
 assert.deepEqual(fireworkCues(null,clock(12)),[]);
});
test('optional fireworks follow visual resets and stay silent during the 20s rest',()=>{
 let previous=clock(0,'show'),cues=[];
 for(let i=1;i<=10000;i++){const current=clock(i/100,'show');cues.push(...fireworkCues(previous,current));previous=current;}
 assert(cues.length>50);assert(cues.every(c=>c.kind==='burst'&&c.at%50<30));
 assert(cues.some(c=>Math.abs(c.at-(3.4-.72+.12))<1e-8));
});
