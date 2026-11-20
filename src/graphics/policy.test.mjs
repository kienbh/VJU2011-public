import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createQualityPolicy,ratioBounds,readQuality,profile} from './policy.ts';
import {thinGroup} from './thinGroup.ts';

test('stored quality is validated, mobile resolution is never initially below 1.5',()=>{
  for(const value of [null,{},[],{quality:'invalid'},'beautiful'])assert.equal(readQuality(value),'auto');
  assert.equal(readQuality({quality:'economy',future:'kept'}),'economy');
  for(const dpr of [1,1.25,1.5,2,3,NaN]){const b=ratioBounds(true,dpr);assert(b.floor>=1.5);assert(b.ceiling>=1.5&&b.ceiling<=2);}
  assert.deepEqual(ratioBounds(false,1),{floor:1,ceiling:1});assert.equal(ratioBounds(false,3).ceiling,2);
});
test('sustained slowness reduces density, shadows, reflection, far before resolution',()=>{
  const p=createQualityPolicy(true,3),changes=[];
  for(let t=0;t<=20000;t+=100){if(p.sample(t,40))changes.push({t,...p.state()});}
  assert.deepEqual(changes.slice(0,4).map(s=>[s.stage,s.ratio]),[[1,2],[2,2],[3,2],[4,2]]);
  assert.deepEqual(changes.slice(4).map(s=>s.ratio),[1.75,1.5]);
  changes.forEach((s,i)=>{if(i)assert(s.t-changes[i-1].t>=3000);});
  assert.equal(profile(1).shadows,true);assert.equal(profile(2).reflection,true);assert.equal(profile(3).far,1400);assert.equal(profile(4).far,1000);
});
test('very weak hardware must stay slow at the normal floor before exceptional 1.25',()=>{
  const p=createQualityPolicy(true,3),changes=[];
  for(let t=0;t<=60000;t+=100){if(p.sample(t,65))changes.push({t,...p.state()});}
  const floor=changes.find(s=>s.ratio===1.5),weak=changes.find(s=>s.ratio===1.25);
  assert(weak.t-floor.t>=10000);assert.equal(p.state().ratio,1.25);
});
test('fast frames restore resolution by 0.25 per five seconds then detail',()=>{
  const p=createQualityPolicy(true,3);
  for(let t=0;t<=40000;t+=100)p.sample(t,65);
  const changes=[];for(let t=40100;t<=85000;t+=100)if(p.sample(t,16))changes.push({t,...p.state()});
  assert.deepEqual(changes.slice(0,3).map(s=>s.ratio),[1.5,1.75,2]);assert.equal(p.state().stage,0);
  changes.forEach((s,i)=>{if(i)assert(s.t-changes[i-1].t>=5000);});
});
test('hidden tab, isolated stalls and threshold jitter do not accumulate a downgrade',()=>{
  const p=createQualityPolicy(true,3);
  for(let t=0;t<3000;t+=100)p.sample(t,40);
  p.sample(3000,40,true);p.sample(99999,40);assert.equal(p.state().stage,0);
  p.sample(100000,600);for(let t=100100;t<=106000;t+=100)p.sample(t,t%200?35:25);
  assert.equal(p.state().stage,0);
});
test('explicit levels stay selected; switching back to auto resets sampling history',()=>{
  for(const mode of ['beautiful','balanced','economy']){
    const p=createQualityPolicy(true,3,mode),state=p.state();
    for(let t=0;t<60000;t+=100)p.sample(t,100);
    assert.deepEqual(p.state(),state);p.select('auto',60000);p.sample(60001,100);assert.equal(p.state().stage,0);
  }
});
test('thinGroup distributes samples and restores matrices/colors without moving colliders',()=>{
  const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial(),10),m=new THREE.Matrix4();
  for(let i=0;i<10;i++){mesh.setMatrixAt(i,m.makeTranslation(i,0,0));mesh.setColorAt(i,new THREE.Color(i/10,0,0));}
  const before=Array.from(mesh.instanceMatrix.array),colors=Array.from(mesh.instanceColor.array),thin=thinGroup(mesh);
  thin(.5);assert.equal(mesh.count,5);const xs=[];for(let i=0;i<5;i++){mesh.getMatrixAt(i,m);xs.push(m.elements[12]);}assert.deepEqual(xs,[0,2,4,6,8]);
  thin(1);assert.deepEqual(Array.from(mesh.instanceMatrix.array),before);assert.deepEqual(Array.from(mesh.instanceColor.array),colors);
  mesh.geometry.dispose();mesh.material.dispose();
});
