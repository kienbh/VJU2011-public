import {fireworkCues,type FireworkClock,type FireworkCue} from './fireworkCues.ts';
const FILES=['launch','burst-1','burst-2','burst-3'] as const;
/** CC0 field recordings. Only local assets, bounded voices, no delayed playback on download completion. */
export function createFireworkAudio(ctx:AudioContext,out:AudioNode){
 const buffers=new Map<string,AudioBuffer>(),voices=new Set<AudioBufferSourceNode>();
 let previous:FireworkClock=null;
 const fetchInto=async(name:string,url:string)=>{
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),8000);
  try{const r=await fetch(url,{signal:abort.signal});if(!r.ok)return;
   buffers.set(name,await ctx.decodeAudioData(await r.arrayBuffer()));
  }catch{/* Silence is safer than a late burst or an exception in gameplay. */}finally{clearTimeout(timer);}
 };
 const ready=Promise.all(FILES.map(name=>fetchInto(name,`/assets/audio/fireworks/${name}.mp3`)));
 function stop(){for(const source of voices.keys()){try{source.stop();}catch{/* ended */}}voices.clear();}
 function play(cue:FireworkCue){
  const name=cue.kind==='launch'?'launch':`burst-${cue.variant+1}`,buffer=buffers.get(name);
  // Reserve three voices for explosion reports.
  if(!buffer||voices.size>=8||(cue.kind==='launch'&&voices.size>=5))return;
  const source=ctx.createBufferSource(),gain=ctx.createGain(),pan=ctx.createStereoPanner();source.buffer=buffer;
  gain.gain.value=cue.gain??(cue.kind==='launch'?.12:.40);pan.pan.value=cue.pan;
  source.connect(gain).connect(pan).connect(out);voices.add(source);
  source.onended=()=>{voices.delete(source);source.disconnect();gain.disconnect();pan.disconnect();};
  source.start(ctx.currentTime+.005);
 }
 return {ready,update(clock:FireworkClock,enabled:boolean){
  if(!enabled||!clock||previous?.mode!==clock.mode)stop();
  const cues=enabled?fireworkCues(previous,clock):[];
  previous=clock?{...clock}:null;
  for(const cue of cues)play(cue);
 },stop};
}
