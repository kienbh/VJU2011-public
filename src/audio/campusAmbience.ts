/** Positional campus soundscape from local CC0 recordings (public/assets/audio/campus, see README there).
 * - Loops fade in near their place and pan with the camera heading; far loops stop after a grace period.
 * - Emitters play a one-shot at random intervals while the listener is near (birds, a passing motorbike).
 * - Event one-shots (kick, net, whistle, splash, pour, clink, bell, page) are played by game actions.
 * Buffers load on demand (preload when approaching); nothing here may throw into the render loop. */
export type Listener={x:number;z:number;fx:number;fz:number};
export type AmbienceFrame={listener:Listener|null;festival:boolean;library:boolean;finale:boolean};
type Place={x:number;z:number;r:number};
export type Loop=Place&{id:string;file:string;gain:number;festival?:boolean};
export type Emitter=Place&{id:string;file:string;gain:number;every:[number,number];sweep?:boolean};
/** Quiet zones (lotus pond, sakura) get only natural sounds. Evening insects/frogs and chatter only with the festival (evening) layer. */
export const LOOPS:Loop[]=[
  {id:'water-koi',file:'water',x:132,z:-124,r:16,gain:.3},
  {id:'water-lotus',file:'water',x:115,z:-185,r:14,gain:.26},
  {id:'water-campfire',file:'water',x:58,z:-176,r:14,gain:.2},
  {id:'fire',file:'fire',x:62,z:-169,r:13,gain:.5},
  {id:'chimes',file:'chimes',x:137,z:-116,r:13,gain:.2},
  {id:'leaves',file:'leaves',x:111,z:-115,r:15,gain:.28},
  {id:'crickets-garden',file:'crickets',x:-56,z:23,r:26,gain:.14,festival:true},
  {id:'crickets-lotus',file:'crickets',x:106,z:-181,r:26,gain:.14,festival:true},
  {id:'frogs',file:'frogs',x:115,z:-185,r:22,gain:.18,festival:true},
  {id:'murmur',file:'murmur',x:16,z:20,r:36,gain:.12,festival:true},
];
export const EMITTERS:Emitter[]=[
  {id:'birds-sakura',file:'birds',x:111,z:-115,r:22,gain:.28,every:[7,15]},
  {id:'birds-flowers',file:'birds',x:34,z:11,r:22,gain:.22,every:[9,18]},
  {id:'motorbike',file:'motorbike',x:207,z:92,r:36,gain:.38,every:[14,28],sweep:true},
];
/** Event sounds are fetched when the listener comes within range, so the first action is not late. */
export const PRELOAD:(Place&{files:string[]})[]=[
  {x:165,z:10,r:45,files:['kick','net','whistle']},{x:132,z:-122,r:30,files:['splash']},{x:129,z:-114,r:25,files:['pour','clink']},
  {x:207,z:81.5,r:30,files:['bell']},{x:170,z:-39,r:25,files:['page','rain']},
];
export const EVENT_GAIN:Record<string,number>={kick:.5,net:.42,whistle:.3,splash:.45,pour:.35,clink:.35,bell:.4,page:.3};
/** 1 at the centre, smooth falloff to 0 at the radius. */
export function proximity(d:number,r:number){const t=Math.min(1,Math.max(0,(d-r*.2)/(r*.8)));return (1-t)*(1-t);}
/** -1 left … 1 right relative to where the listener faces (forward fx,fz in the XZ plane). */
export function panFor(l:Listener,x:number,z:number){const dx=x-l.x,dz=z-l.z,d=Math.hypot(dx,dz);if(d<.5)return 0;const len=Math.hypot(l.fx,l.fz)||1;return Math.max(-.8,Math.min(.8,(dx*(-l.fz/len)+dz*(l.fx/len))/d*.8));}

export function createCampusAmbience(ctx:AudioContext,out:AudioNode){
  const buffers=new Map<string,Promise<AudioBuffer|null>>(),ready=new Map<string,AudioBuffer>();
  const loops=new Map<string,{src:AudioBufferSourceNode;gain:GainNode;pan:StereoPannerNode;idle:number}>();
  const voices=new Set<AudioBufferSourceNode>(),nextEmit=new Map<string,number>();
  let listener:Listener|null=null,clock=0;
  function load(file:string){
    let task=buffers.get(file);
    if(!task){task=(async()=>{const ac=new AbortController(),t=setTimeout(()=>ac.abort(),8000);
      try{const r=await fetch(`/assets/audio/campus/${file}.mp3`,{signal:ac.signal});if(!r.ok)return null;const b=await ctx.decodeAudioData(await r.arrayBuffer());ready.set(file,b);return b;}
      catch{return null;}finally{clearTimeout(t);}})();buffers.set(file,task);}
    return task;
  }
  function chain(gain:number,pan:number){const g=ctx.createGain(),p=ctx.createStereoPanner();g.gain.value=gain;p.pan.value=pan;g.connect(p).connect(out);return {g,p};}
  /** One-shot. Returns false when it could not start now (not loaded yet, or voice cap). */
  function play(file:string,{gain=EVENT_GAIN[file]??.35,at,delay=0,sweep=false}:{gain?:number;at?:{x:number;z:number};delay?:number;sweep?:boolean}={}){
    const buffer=ready.get(file);if(!buffer){void load(file);return false;}
    if(voices.size>=5)return false;
    let level=gain,pan=0;
    if(at&&listener){const d=Math.hypot(at.x-listener.x,at.z-listener.z);level*=Math.max(.25,proximity(d,40));pan=panFor(listener,at.x,at.z);}
    const src=ctx.createBufferSource(),{g,p}=chain(level,pan),start=ctx.currentTime+.01+delay;src.buffer=buffer;src.connect(g);
    if(sweep){const dir=Math.random()<.5?-1:1;p.pan.setValueAtTime(-.85*dir,start);p.pan.linearRampToValueAtTime(.85*dir,start+buffer.duration);}
    voices.add(src);src.onended=()=>{voices.delete(src);src.disconnect();g.disconnect();p.disconnect();};src.start(start);return true;
  }
  /** Event one-shot that waits briefly for a first download, but never plays late. */
  function event(file:string,opts:{gain?:number;at?:{x:number;z:number};delay?:number}={}){
    if(play(file,opts))return;const asked=performance.now();
    void load(file).then(b=>{if(b&&performance.now()-asked<600)play(file,opts);});
  }
  function stopLoop(id:string){const l=loops.get(id);if(!l)return;try{l.src.stop();}catch{/* ended */}l.src.disconnect();l.gain.disconnect();l.pan.disconnect();loops.delete(id);}
  function stop(){for(const id of [...loops.keys()])stopLoop(id);for(const v of voices){try{v.stop();}catch{/* ended */}}voices.clear();}
  function setLoop(id:string,file:string,target:number,pan:number,dt:number){
    const now=ctx.currentTime,l=loops.get(id);
    if(target>.002){
      if(!l){const b=ready.get(file);if(!b){void load(file);return;}
        const src=ctx.createBufferSource(),{g,p}=chain(0,pan);src.buffer=b;src.loop=true;src.connect(g);src.start(now,Math.random()*b.duration);
        loops.set(id,{src,gain:g,pan:p,idle:0});g.gain.setTargetAtTime(target,now,.6);return;}
      l.idle=0;l.gain.gain.setTargetAtTime(target,now,.35);l.pan.pan.setTargetAtTime(pan,now,.2);
    }else if(l){l.gain.gain.setTargetAtTime(0,now,.4);l.idle+=dt;if(l.idle>6)stopLoop(id);}
  }
  function update(dt:number,f:AmbienceFrame){
    clock+=dt;listener=f.listener;const l=f.listener;
    for(const loop of LOOPS){
      const near=l&&!f.library&&!f.finale&&(!loop.festival||f.festival)?proximity(Math.hypot(loop.x-l.x,loop.z-l.z),loop.r):0;
      setLoop(loop.id,loop.file,loop.gain*near,l?panFor(l,loop.x,loop.z):0,dt);
    }
    // Reading room: soft rain behind the window while the library is open.
    setLoop('library-rain','rain',f.library?.2:0,0,dt);
    if(!l||f.library||f.finale)return;
    for(const p of PRELOAD)if(Math.hypot(p.x-l.x,p.z-l.z)<p.r)p.files.forEach(file=>void load(file));
    for(const e of EMITTERS){
      const d=Math.hypot(e.x-l.x,e.z-l.z);if(d>e.r){nextEmit.delete(e.id);continue;}
      void load(e.file);const due=nextEmit.get(e.id);
      if(due===undefined){nextEmit.set(e.id,clock+e.every[0]*.4+Math.random()*e.every[0]);continue;}
      if(clock>=due){play(e.file,{gain:e.gain*Math.max(.3,proximity(d,e.r)),at:e.sweep?undefined:{x:e.x,z:e.z},sweep:e.sweep});nextEmit.set(e.id,clock+e.every[0]+Math.random()*(e.every[1]-e.every[0]));}
    }
  }
  return {play,event,update,stop,load,state:()=>({loops:[...loops.keys()],voices:voices.size,loaded:[...ready.keys()]})};
}
