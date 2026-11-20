import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createFootball} from './football.ts';
import {FOOTBALL as F} from '../scene/footballLayout.ts';

function setup(){
  const awards=[],kicks=[],ball=new THREE.Object3D();
  const game=createFootball(ball,{onKick:h=>kicks.push(h),onGoal:n=>awards.push({n,at:ball.position.clone()})});
  const tick=n=>{for(let i=0;i<n;i++)game.update(.05,true);};
  return {game,ball,awards,kicks,tick};
}
for(const direction of [-1,1])test(`shot toward ${direction<0?'west':'east'} goal crosses inside net, counts once and resets`,()=>{
  const {game,ball,awards,tick}=setup();
  assert.equal(game.kick({x:F.x-direction*2,z:F.z},direction*Math.PI/2,true),true);
  assert.equal(game.kick({x:165,z:8},0,true),false);
  tick(20);assert.equal(awards.length,0);assert.ok(ball.position.y>F.ground+F.radius);
  tick(20);assert.equal(game.state().phase,'goal');assert.equal(awards.length,1);
  const goalX=F.goalXs[direction<0?0:1],point=awards[0].at;
  assert.ok(direction*(point.x-goalX)>F.radius);
  assert.ok(point.y+F.radius<F.goal.height);
  assert.ok(Math.abs(point.z-F.z)+F.radius<F.goal.width/2);
  assert.ok(Math.abs(ball.position.x-goalX)+F.radius<F.goal.depth);
  tick(50);assert.deepEqual(ball.position.toArray(),[F.x,F.ground+F.radius,F.z]);
  assert.equal(game.state().phase,'ready');assert.equal(awards.length,1);
  assert.equal(game.kick({x:F.x-direction*2,z:F.z},direction*Math.PI/2,true),true);
  tick(40);assert.equal(game.state().goals,2);assert.equal(awards.length,2);
});
test('distance, modal pause and invalid input cannot trigger or advance shots',()=>{
  const {game,ball,kicks,tick}=setup();
  assert.equal(game.kick({x:160,z:8},0,true),false);
  assert.equal(game.kick({x:167,z:8},0,false),false);
  assert.equal(game.kick({x:167,z:8},NaN,true),false);
  assert.equal(kicks.length,0);
  assert.equal(game.kick({x:167,z:10},0,true),true);
  tick(8);const before=game.state();
  game.update(5,false);game.update(NaN,true);game.update(-1,true);
  assert.deepEqual(game.state(),before);
  game.update(100,true);assert.ok(ball.position.distanceTo(new THREE.Vector3(...before.position))<2.2);
});

test('diagonal shot follows the player-to-ball vector, can miss, and returns the ball',()=>{
 const {game,ball,awards,tick}=setup();
 assert.equal(game.kick({x:165,z:10},0,true),true);assert.ok(new THREE.Vector3(...game.state().direction).distanceTo(new THREE.Vector3(Math.SQRT1_2,0,-Math.SQRT1_2))<1e-12);tick(40);
 assert.ok(Math.abs(ball.position.z-F.z)>F.goal.width/2);assert.equal(awards.length,0);
 tick(50);assert.equal(game.state().phase,'ready');assert.deepEqual(ball.position.toArray(),[F.x,F.ground+F.radius,F.z]);
});

test('the first frame moves immediately; turning the camera does not change a shot',()=>{
 const a=setup(),b=setup();a.game.kick({x:165,z:8},0,true);b.game.kick({x:165,z:8},Math.PI,true);
 a.game.update(1/60,true);b.game.update(1/60,true);assert.ok(a.ball.position.x>F.x);assert.deepEqual(a.ball.position.toArray(),b.ball.position.toArray());
});
test('standing exactly on the ball uses finite heading without NaN',()=>{
 const {game,ball,tick}=setup();assert(game.kick({x:F.x,z:F.z},0,true));tick(40);assert(ball.position.toArray().every(Number.isFinite));assert.equal(game.state().goals,0);
});
