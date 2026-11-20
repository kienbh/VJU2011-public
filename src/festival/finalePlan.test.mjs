import test from 'node:test';import assert from 'node:assert/strict';
import {FINALE_SECONDS,FINALE_SHELLS,FINALE_PARTICLES,FINALE_PLAN,finaleShell,finaleBudget,finaleHalo,finaleWord,finaleHash} from './finalePlan.ts';
test('reference words hold for six seconds and close on 20.11',()=>{
 assert.equal(FINALE_SECONDS,30);assert.deepEqual([0,6,12,18,24,30].map(finaleWord),[0,1,2,3,4,4]);assert.equal(finaleWord(-2),0);
});
test('every shell launches, bursts and burns out inside the finale, with hearts and portrait layout',()=>{
 const shells=Array.from({length:FINALE_SHELLS},(_,i)=>finaleShell(i));
 assert(shells.every(s=>s.launch>0&&Math.abs(s.launch+s.flight-s.burst)<1e-9&&s.burst+s.life<FINALE_SECONDS));
 assert(shells.some(s=>s.kind===1));assert(shells.every(s=>Math.abs(s.tall[0])<=23&&s.tall[1]>=65));
 // Spheres/willows lead; hearts and rings are accents.
 const accents=shells.filter(s=>s.kind===1||s.kind===2).length;assert(accents<=shells.length/3);
 assert.deepEqual(FINALE_PLAN.map(s=>s.burst),shells.map(s=>s.burst));
});
test('rhythm opens sparse, rests before 20.11 forms, and peaks near the end',()=>{
 const count=(a,b)=>FINALE_PLAN.filter(s=>s.burst>=a&&s.burst<b).length;
 assert(count(0,6)<=5);assert(count(24.6,27.2)>=12);assert(count(23.4,24.6)===0);
 assert(count(24.6,27.2)/2.6>2*count(0,24)/24,'climax at least twice the average density');
 assert(Math.max(...FINALE_PLAN.map(s=>s.burst+s.life))>29,'falling embers carry the close');
 const gaps=FINALE_PLAN.slice(1).map((s,i)=>s.burst-FINALE_PLAN[i].burst);assert(new Set(gaps.map(g=>g.toFixed(2))).size>10,'not a fixed metronome');
});
test('depth varies and the audio report follows farther bursts later and softer',()=>{
 assert.equal(new Set(FINALE_PLAN.map(s=>s.z)).size,3);
 const near=FINALE_PLAN.find(s=>s.depth===0),far=FINALE_PLAN.find(s=>s.depth===2);
 assert(far.soundDelay>near.soundDelay&&near.soundDelay>=.1&&far.soundDelay<=.25);
 assert(FINALE_PLAN.filter(s=>s.depth===2&&s.radius>0).every(s=>s.gain<.5));
});
test('seeded variation is stable and budgets stay bounded',()=>{
 assert.equal(finaleHash(3,4),finaleHash(3,4));assert.notEqual(finaleHash(3,4),finaleHash(4,3));
 assert.equal(FINALE_PARTICLES,FINALE_PLAN.reduce((n,s)=>n+s.stars+2,0));assert(FINALE_PARTICLES<=7000);
 assert.equal(finaleBudget(99999),FINALE_PARTICLES);assert.equal(finaleBudget(11500),FINALE_PARTICLES);
 assert(finaleBudget(4800)<finaleBudget(7200)&&finaleBudget(7200)<FINALE_PARTICLES);
 assert.equal(finaleBudget(NaN),finaleBudget(4800));assert.equal(finaleBudget(1),finaleBudget(4800));
 assert(finaleBudget(1)>=FINALE_PLAN.length*2,'rockets and flashes always fit');
 assert.equal(finaleHalo(4800),false);assert.equal(finaleHalo(7200),true);assert.equal(finaleHalo(NaN),false);
});
