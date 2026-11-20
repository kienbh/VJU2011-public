export type Quality = 'auto' | 'beautiful' | 'balanced' | 'economy';
export const SETTINGS_KEY = 'vju2011-settings-v1';
export const qualities:Quality[] = ['auto','beautiful','balanced','economy'];
export function readQuality(value:unknown):Quality {
  if(value && typeof value==='object' && qualities.includes((value as {quality:Quality}).quality))return (value as {quality:Quality}).quality;
  return 'auto';
}
export function ratioBounds(phone:boolean,dpr:number){
  const native=Number.isFinite(dpr)&&dpr>0?dpr:1;
  return {ceiling:phone?Math.max(1.5,Math.min(native,2)):Math.min(native,2),floor:phone?1.5:Math.min(native,2)};
}
export function profile(stage:number){
  return {density:stage>=1?.65:1,shadows:stage<2,reflection:stage<4,reflectionInterval:stage>=3?250:0,far:stage>=4?1000:1400,
    particles:stage>=3?4800:stage>=1?7200:11500};
}

/** Frame-time hysteresis. Resource cuts precede resolution; recovery reverses that order. */
export function createQualityPolicy(phone:boolean,dpr:number,quality:Quality='auto'){
  const bounds=ratioBounds(phone,dpr);
  let mode=quality,stage=0,ratio=bounds.ceiling,lastChange=0,slowSince:number|undefined,fastSince:number|undefined,weakSince:number|undefined;
  const resetWindows=()=>{slowSince=fastSince=weakSince=undefined;};
  function select(next:Quality,now=0){mode=next;stage=next==='economy'?4:next==='balanced'?1:0;ratio=bounds.ceiling;lastChange=now;resetWindows();}
  select(quality);
  function sample(now:number,ms:number,hidden=false){
    if(hidden||mode!=='auto'||!Number.isFinite(ms)||ms<=0||ms>250){resetWindows();return false;}
    if(ms>32){
      fastSince=undefined;slowSince??=now;
      if(stage===4&&ratio<=bounds.floor&&ms>55)weakSince??=now;else weakSince=undefined;
      if(now-lastChange<3000||now-slowSince<3000)return false;
      if(stage<4)stage++;
      else if(ratio>bounds.floor)ratio=Math.max(bounds.floor,ratio-.25);
      else if(weakSince!==undefined&&now-weakSince>=10000&&ratio>1.25)ratio=Math.max(1.25,ratio-.25);
      else return false;
      lastChange=now;slowSince=now;weakSince=undefined;return true;
    }
    slowSince=weakSince=undefined;
    if(ms<20){
      fastSince??=now;
      if(now-fastSince<5000||now-lastChange<3000)return false;
      if(ratio<bounds.ceiling)ratio=Math.min(bounds.ceiling,ratio+.25);
      else if(stage>0)stage--;
      else return false;
      lastChange=now;fastSince=now;return true;
    }
    fastSince=undefined;return false;
  }
  return {select,sample,state:()=>({mode,stage,ratio,...profile(stage)})};
}
