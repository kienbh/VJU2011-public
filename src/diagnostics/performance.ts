// Opt-in, bounded, local-only measurements. No names, messages, coordinates or cookies.
type Reading = {input:{enabled:boolean;stickActive:boolean;keysHeld:number;movedLastFrame:number};network:{lastRttMs:number|null;failures:number}|undefined;graphics:object};
export function mountPerformanceProbe(read:()=>Reading){
 if(new URLSearchParams(location.search).get('perf')!=='1')return {frame(_ms:number){}};
 let frames:number[]=[],lastFrame=performance.now(),lastSample=performance.now(),hidden=document.hidden;
 const samples:object[]=[],events:object[]=[];let health:{ms:number|null;status:number|null}={ms:null,status:null};
 const panel=document.createElement('details');panel.className='performance-probe';
 panel.innerHTML='<summary>Đo hiệu năng</summary><output>Đang đo…</output><button type="button" data-mark>Vừa bị khựng</button><button type="button" data-save>Lưu báo cáo</button><small>Chỉ đo trên máy này · Không gửi dữ liệu cá nhân</small>';
 const style=document.createElement('style');style.textContent='.performance-probe{position:fixed;right:8px;top:76px;z-index:2500;background:#163b39;color:#fff;padding:8px;border-radius:8px;font:14px/1.5 system-ui;max-width:min(270px,75vw)}.performance-probe summary{min-height:32px;cursor:pointer}.performance-probe output,.performance-probe small{display:block;white-space:pre-line}.performance-probe button{min-height:44px;margin:4px;padding:6px;background:#fff;color:#163b39;border:0;border-radius:5px}';
 document.head.append(style);document.body.append(panel);
 const event=(type:string)=>{events.push({at:new Date().toISOString(),type});if(events.length>50)events.shift();};
 panel.querySelector('[data-mark]')!.addEventListener('click',()=>{event('user_marked_stutter');panel.querySelector('[data-mark]')!.textContent='Đã đánh dấu';});
 panel.querySelector('[data-save]')!.addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify({format:1,capturedAt:new Date().toISOString(),userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},deviceVerification:'Not inferred: operator must state real device or emulation',samples,events},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='vju2011-performance-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
 });
 document.addEventListener('visibilitychange',()=>{hidden=document.hidden;frames=[];lastFrame=lastSample=performance.now();event(hidden?'tab_hidden':'tab_visible');});
 document.addEventListener('pointercancel',()=>event('pointer_cancel'),true);
 document.addEventListener('lostpointercapture',()=>event('pointer_capture_lost'),true);
 document.addEventListener('webglcontextlost',()=>event('webgl_context_lost'),true);
 window.addEventListener('error',()=>event('javascript_error'));
 async function probe(){if(document.hidden)return;const start=performance.now();try{const r=await fetch('/api/health',{cache:'no-store',signal:AbortSignal.timeout(4000)});await r.text();health={ms:Math.round(performance.now()-start),status:r.status};}catch{health={ms:null,status:null};event('health_timeout_or_network_error');}}
 void probe();setInterval(()=>void probe(),5000);
 setInterval(()=>{
  if(hidden)return;
  const now=performance.now(),sorted=[...frames].sort((a,b)=>a-b),reading=read();
  const sample={at:new Date().toISOString(),fps:Math.round(frames.length*1000/(now-lastSample)),frameP95Ms:Math.round(sorted[Math.floor(sorted.length*.95)]||0),frameMaxMs:Math.round(sorted.at(-1)||0),noFrameForMs:Math.round(now-lastFrame),health,...reading};
  samples.push(sample);if(samples.length>120)samples.shift();
  panel.querySelector('summary')!.textContent=`Đo hiệu năng · ${sample.fps} FPS`;
  panel.querySelector('output')!.textContent=`Khung hình p95: ${sample.frameP95Ms} ms\nĐồng bộ: ${reading.network?.lastRttMs==null?'chưa có phản hồi':reading.network.lastRttMs+' ms'}\nĐiều khiển: ${!reading.input.enabled?'đang khóa':reading.input.stickActive||reading.input.keysHeld?'đang giữ':'đã thả'} · ${reading.input.movedLastFrame>0?'đang đi':'đứng yên'}`;
  frames=[];lastSample=now;
 },1000);
 return {frame(ms:number){lastFrame=performance.now();if(!hidden&&Number.isFinite(ms)){frames.push(ms);if(frames.length>300)frames.shift();}}};
}
