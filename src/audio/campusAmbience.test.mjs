import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {LOOPS,EMITTERS,PRELOAD,EVENT_GAIN,proximity,panFor} from './campusAmbience.ts';
test('loudness falls smoothly with distance and is silent outside the radius',()=>{
 assert.equal(proximity(0,10),1);assert.equal(proximity(2,10),1);assert.equal(proximity(10,10),0);assert.equal(proximity(30,10),0);
 const steps=[0,2,4,6,8,10].map(d=>proximity(d,10));assert(steps.every((v,i)=>i===0||v<=steps[i-1]));
});
test('pan follows the camera heading',()=>{
 const north={x:0,z:0,fx:0,fz:-1};// looking toward -z: +x is to the right
 assert(panFor(north,10,0)>.7);assert(panFor(north,-10,0)<-.7);assert(Math.abs(panFor(north,0,-10))<1e-9);
 const east={x:0,z:0,fx:1,fz:0};assert(panFor(east,0,10)>.7,'looking +x, +z is to the right');
 assert.equal(panFor(north,.1,.1),0);
});
test('quiet places get only natural sounds; insects and chatter only with the evening festival layer',()=>{
 const near=(x,z,p)=>Math.hypot(p.x-x,p.z-z)<p.r;
 const lotus=[...LOOPS,...EMITTERS].filter(p=>near(106,-181,p)).map(p=>p.file);
 assert(lotus.length&&lotus.every(f=>['water','crickets','frogs'].includes(f)),lotus.join());
 for(const l of LOOPS)if(['crickets','frogs','murmur'].includes(l.file))assert.equal(l.festival,true,l.id);
 assert(LOOPS.every(l=>l.gain<=.5)&&EMITTERS.every(e=>e.gain<=.4&&e.every[0]>=7),'ambience stays soft and sparse');
});
test('every referenced file ships with a CC0 manifest entry',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../../public/assets/audio/campus/manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.license,'CC0-1.0');const shipped=new Set(manifest.files.map(f=>f.file.replace('.mp3','')));
 const used=new Set([...LOOPS.map(l=>l.file),...EMITTERS.map(e=>e.file),...PRELOAD.flatMap(p=>p.files),...Object.keys(EVENT_GAIN),'ooh','applause']);
 for(const f of used)assert(shipped.has(f),f);
 for(const f of manifest.files)assert(/freesound\.org/.test(f.page)&&f.sha256&&f.bytes>0,f.file);
 for(const l of new Set(LOOPS.map(l=>l.file)))assert(manifest.files.find(f=>f.file===l+'.mp3').loop,`${l} prepared as a seamless loop`);
});
