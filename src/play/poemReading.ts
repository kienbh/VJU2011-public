import {tr} from '../i18n/index.ts';

/** Explicit, cancellable device speech. Never substitute an unrelated-language voice. */
export function mountPoemReading(article:HTMLElement,text:string,isMuted:()=>boolean){
 const controls=document.createElement('aside');controls.className='poem-reading';
 const button=document.createElement('button');button.type='button';button.dataset.poemRead='';
 const note=document.createElement('p');note.className='poem-reading-status';note.setAttribute('role','status');
 controls.append(button,note);article.querySelector('.lake-poem-author')!.after(controls);
 const synth=typeof window.speechSynthesis==='object'?window.speechSynthesis:null;
 const supported=!!synth&&typeof SpeechSynthesisUtterance==='function';
 const events=new AbortController();let utterance:SpeechSynthesisUtterance|null=null,timer=0,disposed=false;
 function paint(message=''){
  button.textContent=utterance?tr('■ Dừng đọc'):tr('🔊 Nghe đọc');
  button.setAttribute('aria-pressed',String(!!utterance));note.textContent=message;note.hidden=!message;
 }
 function stop(message=''){
  const old=utterance;utterance=null;clearTimeout(timer);
  if(old){old.onstart=null;old.onend=null;old.onerror=null;try{synth?.cancel();}catch{/* Speech must not interrupt campus. */}}
  if(!disposed)paint(message);
 }
 function voices(){try{return synth?.getVoices().filter(v=>/^vi(?:[-_]|$)/i.test(v.lang))??[];}catch{return [];}}
 function unavailable(){return supported?tr('Thiết bị chưa có giọng đọc tiếng Việt. Bạn vẫn có thể đọc bài thơ.'):tr('Trình duyệt này chưa hỗ trợ đọc thành tiếng.');}
 function refresh(){if(!utterance)paint(voices().length?'':unavailable());}
 button.addEventListener('click',()=>{
  if(utterance){stop();return;}
  if(document.hidden)return;
  if(isMuted()){paint(tr('Đang tắt âm thanh · bật loa để nghe'));return;}
  const voice=voices().sort((a,b)=>Number(/natural|neural|premium|enhanced/i.test(b.name))-Number(/natural|neural|premium|enhanced/i.test(a.name))||Number(b.default)-Number(a.default))[0];
  if(!supported||!voice){paint(unavailable());return;}
  const failed=()=>tr('Chưa phát được giọng đọc. Bấm nghe để thử lại.');
  try{
   synth!.cancel();const u=new SpeechSynthesisUtterance(text);utterance=u;
   u.lang='vi-VN';u.voice=voice;u.rate=.85;u.pitch=1;u.volume=1;
   u.onstart=()=>{if(utterance!==u||disposed)return;clearTimeout(timer);paint(tr('Đang đọc bằng giọng tiếng Việt của thiết bị.'));};
   u.onend=()=>{if(utterance===u)stop();};
   u.onerror=()=>{if(utterance===u)stop(failed());};
   paint(tr('Đang mở giọng đọc…'));timer=window.setTimeout(()=>{if(utterance===u)stop(failed());},8000);
   synth!.speak(u);
  }catch{stop(failed());}
 },{signal:events.signal});
 synth?.addEventListener?.('voiceschanged',refresh,{signal:events.signal});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();},{signal:events.signal});
 window.addEventListener('pagehide',()=>stop(),{signal:events.signal});
 refresh();
 return {checkMute(){if(utterance&&isMuted())stop(tr('Đang tắt âm thanh · bật loa để nghe'));},dispose(){stop();disposed=true;events.abort();controls.remove();}};
}
