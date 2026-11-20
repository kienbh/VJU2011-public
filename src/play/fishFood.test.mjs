import test from 'node:test';
import assert from 'node:assert/strict';
import {createFishFood} from './fishFood.ts';
test('three throws, no fourth, full refill exactly 60 seconds after depletion',()=>{
 let now=0;const food=createFishFood(()=>now),fish=Array.from({length:20},(_,i)=>({x:i,z:0}));
 assert.equal(food.state().charges,3);for(let i=0;i<3;i++)assert(food.throwAt({x:0,z:0},fish,0));
 assert.equal(food.throwAt({x:0,z:0},fish,0),null);now=59999;assert.deepEqual(food.state(),{charges:0,seconds:1});now=60000;assert.deepEqual(food.state(),{charges:3,seconds:0});
});
test('only nearest five follow after landing; five arrivals consume and release everyone',()=>{
 const food=createFishFood(),fish=Array.from({length:12},(_,i)=>({x:10+i,z:0}));const p=food.throwAt({x:0,z:0},fish,0);
 assert.deepEqual([...p.diners],[0,1,2,3,4]);assert.equal(food.target(0),undefined);food.update(.7,fish);assert.equal(food.target(0),p);assert.equal(food.target(5),undefined);
 for(let i=0;i<5;i++){fish[i]={x:.2,z:.1};food.update(1+i,fish);assert.equal(food.target(i),undefined);}
 assert.equal(food.patches.length,0);assert.equal(food.target(5),undefined);
});
test('multiple bait points do not recruit the same fish; abandoned food expires',()=>{
 const food=createFishFood(),fish=Array.from({length:15},(_,i)=>({x:i+3,z:0}));const a=food.throwAt({x:0,z:0},fish,0),b=food.throwAt({x:0,z:0},fish,0);
 assert([...b.diners].every(id=>!a.diners.has(id)));food.update(26,fish);assert.equal(food.patches.length,0);
 assert.equal(food.throwAt({x:NaN,z:0},fish,27),null);assert.equal(food.state().charges,1);
});
test('a hidden or distant scene expires old bait and cannot overflow the particle pool after refill',()=>{
 let now=0;const food=createFishFood(()=>now);for(let i=0;i<3;i++)food.throwAt({x:0,z:0},[],0);
 now=60001;for(let i=0;i<3;i++)food.throwAt({x:i,z:0},[],0);assert.equal(food.patches.length,3);
 now=90000;food.update(.1,[]);assert.equal(food.patches.length,0);
});
