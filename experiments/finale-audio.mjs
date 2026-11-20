import * as T from 'three';
import {createFinaleFireworks} from '../src/festival/finaleFireworks.ts';
import {createFinaleLettering} from '../src/festival/finaleLettering.ts';
import {createFinaleLogo} from '../src/festival/finaleLogo.ts';
import {createFinaleSky} from '../src/festival/finaleSky.ts';
const $=s=>document.querySelector(s),view=$('#view'),renderer=new T.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));view.append(renderer.domElement);
const scene=new T.Scene(),camera=new T.PerspectiveCamera(64,1,.1,2000);camera.position.set(0,34,150);camera.lookAt(0,46,0);
const fire=createFinaleFireworks(),letters=createFinaleLettering(),logo=createFinaleLogo(),sky=createFinaleSky();scene.add(sky.group,fire.points,letters.points,logo.points);
// Preview-only shader gain. The production shaders and geometry are untouched.
const brightness={value:1};fire.points.traverse(o=>{const m=o.material;if(!m?.isShaderMaterial)return;m.uniforms.previewGain=brightness;m.fragmentShader='uniform float previewGain;\n'+m.fragmentShader.replace('#include <colorspace_fragment>','gl_FragColor.rgb *= previewGain;\n#include <colorspace_fragment>');});
function light(value){brightness.value=value;$('#original').setAttribute('aria-pressed',String(value===1));$('#brighter').setAttribute('aria-pressed',String(value>1));}
$('#original').onclick=()=>light(1);$('#brighter').onclick=()=>light(1.35);
let moving=false,time=27.5,previous=performance.now();$('#time').oninput=e=>{time=Number(e.target.value);};
$('#motion').onclick=()=>{moving=!moving;$('#motion').setAttribute('aria-pressed',String(moving));$('#motion').textContent=moving?'Dừng hoạt ảnh':'Chạy hoạt ảnh';};
new ResizeObserver(()=>{const w=view.clientWidth,h=view.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.position.set(1,9,Math.max(90,(camera.aspect>=.85?180:48)/Math.max(.3,camera.aspect)-24));camera.lookAt(1,48,-50);camera.updateProjectionMatrix();}).observe(view);
function frame(now){const dt=Math.min(.05,(now-previous)/1000);previous=now;if(moving&&!document.hidden)time=(time+dt)%30;$('#time').value=String(time);$('#seconds').textContent=time.toFixed(1);const p=time/30;fire.setProgress(p,false,camera.aspect,11500);letters.setProgress(p,false,camera.aspect,11500);logo.setProgress(p,false,camera.aspect);sky.setProgress(p,false);if(!document.hidden)renderer.render(scene,camera);requestAnimationFrame(frame);}requestAnimationFrame(frame);

let ctx,master,timer=null,next=0,note=0,kind='',sources=new Set(),generation=0;
const phrase=[293.66,369.99,440,null,493.88,440,369.99,null,329.63,293.66,null,440,369.99,null,293.66,null];
function stop(){generation++;clearInterval(timer);timer=null;for(const s of sources){try{s.stop();}catch{}}sources.clear();kind='';$('#status').textContent='Âm thanh đang tắt.';document.querySelectorAll('[data-music]').forEach(b=>b.setAttribute('aria-pressed','false'));}
function track(source,tail=[]){sources.add(source);source.onended=()=>{sources.delete(source);source.disconnect();tail.forEach(n=>n.disconnect());};}
function pluck(frequency,at){
 const rate=ctx.sampleRate,length=Math.floor(rate*2.8),period=Math.round(rate/frequency),samples=ctx.createBuffer(1,length,rate),data=samples.getChannelData(0);let random=12345+note;
 for(let i=0;i<period;i++){random=(random*1664525+1013904223)>>>0;data[i]=(random/4294967296*2-1)*.7;}
 for(let i=period;i<length;i++)data[i]=.496*(data[i-period]+data[i-period+1]);
 const s=ctx.createBufferSource(),gain=ctx.createGain();s.buffer=samples;gain.gain.setValueAtTime(.55,at);gain.gain.exponentialRampToValueAtTime(.001,at+2.8);s.connect(gain).connect(master);track(s,[gain]);s.start(at);s.stop(at+2.8);
}
function bend(frequency,at){
 const s=ctx.createOscillator(),gain=ctx.createGain(),vibrato=ctx.createOscillator(),depth=ctx.createGain();s.type='sine';s.frequency.setValueAtTime(frequency*.94,at);s.frequency.exponentialRampToValueAtTime(frequency,at+.24);
 vibrato.frequency.value=5.2;depth.gain.setValueAtTime(0,at);depth.gain.linearRampToValueAtTime(frequency*.007,at+.5);vibrato.connect(depth).connect(s.frequency);
 gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.4,at+.12);gain.gain.exponentialRampToValueAtTime(.001,at+1.9);s.connect(gain).connect(master);track(s,[gain,depth]);track(vibrato);s.start(at);vibrato.start(at);s.stop(at+2);vibrato.stop(at+2);
}
async function play(selected){stop();const ticket=generation;try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('Trình duyệt không hỗ trợ Web Audio');if(!ctx){ctx=new Audio();master=ctx.createGain();const compressor=ctx.createDynamicsCompressor();master.connect(compressor).connect(ctx.destination);}await ctx.resume();if(ticket!==generation)return;if(ctx.state!=='running')throw Error('Chưa mở được âm thanh');master.gain.value=Number($('#volume').value);kind=selected;next=ctx.currentTime+.08;note=0;$('#status').textContent=kind==='koto'?'Đang nghe phác thảo koto.':'Đang nghe phác thảo đàn bầu.';document.querySelectorAll('[data-music]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.music===kind)));
 const schedule=()=>{if(document.hidden||ctx.state!=='running')return stop();const now=ctx.currentTime;if(next<now)next=now+.04;while(next<now+.2){const f=phrase[note%phrase.length];if(f&&sources.size<=(kind==='koto'?5:4))(kind==='koto'?pluck:bend)(f,next);note++;next+=60/54;}};schedule();timer=setInterval(schedule,80);
 }catch(e){stop();$('#status').textContent=e.message;}}
document.querySelectorAll('[data-music]').forEach(b=>b.onclick=()=>void play(b.dataset.music));$('#stop').onclick=stop;$('#volume').oninput=e=>{if(master)master.gain.setTargetAtTime(Number(e.target.value),ctx.currentTime,.05);};document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();ctx?.suspend();}});window.addEventListener('pagehide',stop);
window.__PREVIEW__={state:()=>({brightness:brightness.value,moving,time,music:kind,sources:sources.size,audioState:ctx?.state??'not-created'}),stop};
