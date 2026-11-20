import test from 'node:test';
import assert from 'node:assert/strict';
import {createFireworkAudio} from './fireworkAudio.ts';

// Model overlapping recordings to verify the voice budget and mute behavior.
const durations={'launch':.94,'burst-1':1.20,'burst-2':1.36,'burst-3':2.40};
function audioContext(){
 const live=new Set(),plays=[],stopped=[];
 const ctx={currentTime:0,max:0,plays,stopped,
  decodeAudioData:async bytes=>({name:new TextDecoder().decode(bytes)}),
  createGain:()=>({gain:{value:0},connect(x){return x;},disconnect(){}}),
  createStereoPanner:()=>({pan:{value:0},connect(x){return x;},disconnect(){}}),
  createBufferSource(){const s={buffer:null,onended:null,connect(x){return x;},disconnect(){},
   start(at){s.end=at+durations[s.buffer.name];live.add(s);plays.push({name:s.buffer.name,at});ctx.max=Math.max(ctx.max,live.size);},
   stop(){stopped.push(s.buffer.name);live.delete(s);s.onended?.();}};return s;},
  advance(t){ctx.currentTime=t;for(const s of [...live])if(s.end<=t){live.delete(s);s.onended?.();}},
  get active(){return live.size;}
 };return ctx;
}
test('full finale fetches and plays only fireworks with bounded sources and stops on mute',async t=>{
 const fetched=[];
 t.mock.method(globalThis,'fetch',async url=>(fetched.push(String(url)),{ok:true,arrayBuffer:async()=>new TextEncoder().encode(String(url).split('/').pop().replace('.mp3','')).buffer}));
 const ctx=audioContext(),sound=createFireworkAudio(ctx,{});await sound.ready;
 sound.update({mode:'finale',time:0},true);await new Promise(r=>setImmediate(r));
 for(let i=1;i<=3000;i++){ctx.advance(i/100);sound.update({mode:'finale',time:i/100},true);}
 assert.equal(fetched.length,4);assert(fetched.every(url=>url.startsWith('/assets/audio/fireworks/')));
 assert(ctx.plays.some(p=>p.name==='launch')&&ctx.plays.some(p=>p.name.startsWith('burst')));
 assert(ctx.plays.every(p=>['launch','burst-1','burst-2','burst-3'].includes(p.name)));
 assert(ctx.max<=8,'never more than eight active sources');
 assert(!ctx.stopped.some(n=>n.startsWith('burst')),'reports must not be interrupted');
 sound.update({mode:'finale',time:30.01},false);assert.equal(ctx.active,0);
});

for(const failure of ['404','decode'])test(`unavailable burst-1 (${failure}) is silent and leaves fireworks working`,async t=>{
 t.mock.method(globalThis,'fetch',async url=>({ok:failure!=='404'||!String(url).includes('burst-1'),arrayBuffer:async()=>new TextEncoder().encode(String(url).split('/').pop().replace('.mp3','')).buffer}));
 const ctx=audioContext();if(failure==='decode'){const decode=ctx.decodeAudioData;ctx.decodeAudioData=async bytes=>{const b=await decode(bytes);if(b.name==='burst-1')throw new Error('bad audio');return b;};}
 const sound=createFireworkAudio(ctx,{});await sound.ready;sound.update({mode:'finale',time:0},true);await new Promise(r=>setImmediate(r));
 for(let i=1;i<=3000;i++){ctx.advance(i/100);sound.update({mode:'finale',time:i/100},true);}
 assert(!ctx.plays.some(p=>p.name==='burst-1'));assert(ctx.plays.some(p=>p.name.startsWith('burst')));assert(ctx.max<=8);
 sound.stop();assert.equal(ctx.active,0);
});
