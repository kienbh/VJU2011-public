import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.VJU_PLAYWRIGHT_MODULE||'playwright');
const dir='qa/finale-music-preview';await mkdir(dir,{recursive:true});
const vite=await createServer({server:{host:'127.0.0.1',port:5530,strictPort:true},logLevel:'warn'});await vite.listen();
const browser=await chromium.launch({channel:'msedge',headless:true}),errors=[],results=[];
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const c=await browser.newContext({viewport}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{
   const Native=window.AudioContext;window.AudioContext=class extends Native{constructor(...args){super(...args);const stream=this.createMediaStreamDestination(),analyser=this.createAnalyser();window.__audio={stream,analyser,ctx:this};const connect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(target,...rest){if(target===window.__audio?.ctx.destination){connect.call(this,stream);connect.call(this,analyser);}return connect.call(this,target,...rest);};}};
  });
  await p.goto('http://127.0.0.1:5530/experiments/finale-audio.html');await p.waitForFunction(()=>window.__PREVIEW__);await p.waitForTimeout(1200);
  assert.equal((await p.evaluate(()=>__PREVIEW__.state())).audioState,'not-created');
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.locator('#view').screenshot({path:`${dir}/original-${viewport.width}.png`});await p.locator('#brighter').click();await p.waitForTimeout(300);await p.locator('#view').screenshot({path:`${dir}/brighter-${viewport.width}.png`});assert.equal((await p.evaluate(()=>__PREVIEW__.state())).brightness,1.35);
  for(const kind of ['koto','danbau']){
   await p.locator(`[data-music=${kind}]`).click();assert.equal((await p.evaluate(()=>__PREVIEW__.state())).music,kind);
   await p.evaluate(()=>{const chunks=[];window.recorder=new MediaRecorder(__audio.stream.stream);recorder.ondataavailable=e=>chunks.push(e.data);window.recorded=new Promise(resolve=>recorder.onstop=async()=>{const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());resolve(btoa(String.fromCharCode(...bytes)));});recorder.start();});
   await p.waitForTimeout(6500);const level=await p.evaluate(()=>{const values=new Float32Array(__audio.analyser.fftSize);__audio.analyser.getFloatTimeDomainData(values);return Math.sqrt(values.reduce((sum,v)=>sum+v*v,0)/values.length);});
   assert(level>0,'non-silent '+kind);assert((await p.evaluate(()=>__PREVIEW__.state())).sources<=6);await p.evaluate(()=>recorder.stop());const data=await p.evaluate(()=>recorded);if(viewport.width===1440)await writeFile(`${dir}/${kind}.webm`,Buffer.from(data,'base64'));
   await p.locator('#stop').click();assert.equal((await p.evaluate(()=>__PREVIEW__.state())).sources,0);results.push({viewport,kind,rms:level,sourcesBounded:true});
  }
  await p.locator('[data-music=koto]').click();await p.evaluate(()=>{Object.defineProperty(document,'hidden',{get:()=>true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});await p.waitForTimeout(200);assert.equal((await p.evaluate(()=>__PREVIEW__.state())).sources,0);assert.equal((await p.evaluate(()=>__PREVIEW__.state())).audioState,'suspended');
  await c.close();
 }
 for(const mode of ['unavailable','blocked']){
  const p=await browser.newPage();await p.addInitScript(mode=>{if(mode==='unavailable'){window.AudioContext=undefined;window.webkitAudioContext=undefined;}else window.AudioContext=class{constructor(){throw Error('Audio blocked for QA');}};},mode);p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:5530/experiments/finale-audio.html');await p.locator('[data-music=koto]').click();assert.equal((await p.evaluate(()=>__PREVIEW__.state())).music,'');results.push({audioFailure:mode,handled:true});await p.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({results,errors}));
}finally{await writeFile(`${dir}/results.json`,JSON.stringify({results,errors,realDevice:false,listenedByHuman:false},null,2));await browser.close();await vite.close();}
