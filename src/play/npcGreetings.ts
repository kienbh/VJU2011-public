import {tr,LANG} from '../i18n/index.ts';
import * as T from 'three';
import {npcDeck,OCCASION_LABELS,type NpcLang,type Phrase} from './npcPhrases';
import {createNpcVoice,type VoiceStatus} from './npcVoice';

/** Click/tap (or E) an NPC: it greets in its own language with a speech bubble and native speech.
 * NPC labels distinguish them from online players. Dialogue includes a neutral greeting,
 * wishes for active occasions and everyday conversation only. */
export type NpcTarget={id:string;lang:NpcLang;label:string;position:T.Vector3;height:number;visible:boolean;seed:number;onGreet?:(at:T.Vector3)=>void};
type Options={camera:T.PerspectiveCamera;host:HTMLElement;targets():NpcTarget[];isMuted():boolean;announce?(s:string):void};
const NOTE:Partial<Record<VoiceStatus,string>>={muted:tr('Đang tắt âm thanh · bật loa để nghe'),['no-voice']:tr('Thiết bị chưa có giọng đọc cho ngôn ngữ này'),unsupported:tr('Trình duyệt không hỗ trợ đọc')};
export function mountNpcGreetings(o:Options){
  const voice=createNpcVoice(o.isMuted),decks=new Map<string,{deck:Phrase[];next:number}>();
  const bubble=document.createElement('div');bubble.className='npc-bubble';bubble.hidden=true;bubble.setAttribute('role','status');bubble.setAttribute('aria-live','polite');
  bubble.innerHTML=`<span class="npc-name"></span><p class="npc-line"></p><p class="npc-reading"></p><p class="npc-meaning"></p><div class="npc-foot"><small class="npc-occasion"></small><button type="button" class="npc-replay" aria-label="${tr('Nghe lại')}">${tr('🔊 Nghe lại')}</button></div><small class="npc-note"></small>`;
  o.host.append(bubble);
  const $=<E extends HTMLElement>(s:string)=>bubble.querySelector<E>(s)!;
  let current:{target:NpcTarget;phrase:Phrase;until:number}|null=null,lastGreet=-1;
  const centre=new T.Vector3(),head=new T.Vector3();
  $('.npc-replay').addEventListener('click',e=>{e.stopPropagation();if(current){const s=voice.speak(current.phrase);note(s);current.until=performance.now()+7000;}});
  function note(s:VoiceStatus){const n=$('.npc-note');n.textContent=NOTE[s]??'';n.hidden=!NOTE[s];}
  function find(id:string){return o.targets().find(t=>t.id===id&&t.visible)??null;}
  function greet(id:string){
    const now=performance.now(),target=find(id);if(!target||now-lastGreet<600)return false;lastGreet=now;
    let entry=decks.get(id);if(!entry){entry={deck:npcDeck(target.lang,new Date(),target.seed),next:0};decks.set(id,entry);}
    const phrase=entry.deck[entry.next%entry.deck.length];entry.next++;
    $('.npc-name').textContent=target.label;
    const line=$('.npc-line');line.textContent=phrase.text;line.lang=phrase.lang;
    const reading=$('.npc-reading');reading.textContent=phrase.reading??'';reading.hidden=!phrase.reading;
    // Japanese UI: Vietnamese lines get a Japanese meaning; Japanese lines need no Vietnamese gloss.
    const gloss=LANG==='ja'?(phrase.lang==='vi'?tr(phrase.text):''):phrase.meaning??'';
    const meaning=$('.npc-meaning');meaning.textContent=gloss?`“${gloss}”`:'';meaning.hidden=!gloss;
    const occasion=$('.npc-occasion');occasion.textContent=phrase.occasion?tr(OCCASION_LABELS[phrase.occasion]):'';
    bubble.classList.toggle('is-ja',phrase.lang==='ja');
    note(voice.speak(phrase));
    current={target,phrase,until:now+Math.max(5200,phrase.text.length*170+(gloss?1800:0))};
    target.onGreet?.(target.position);bubble.hidden=false;place();
    return true;
  }
  function hit(ray:T.Raycaster,at:T.Vector3){
    let best:string|null=null,dist=Infinity;
    for(const t of o.targets()){if(!t.visible||t.position.distanceTo(at)>16)continue;
      // Body capsule approximated by two spheres (chest, head): robust for merged static meshes too.
      for(const [y,r] of [[t.height*.55,.5],[t.height*.92,.34]]){centre.set(t.position.x,t.position.y+y,t.position.z);
        if(ray.ray.distanceSqToPoint(centre)<r*r){const d=ray.ray.origin.distanceTo(centre);if(d<dist){dist=d;best=t.id;}}}}
    return best;
  }
  function nearest(at:T.Vector3){let best:NpcTarget|null=null,d=2.6;for(const t of o.targets()){const n=Math.hypot(at.x-t.position.x,at.z-t.position.z);if(t.visible&&n<d){d=n;best=t;}}return best;}
  function hide(){if(!current)return;current=null;bubble.hidden=true;voice.stop();}
  function place(){
    if(!current)return;head.copy(current.target.position);head.y+=current.target.height+.45;head.project(o.camera);
    if(head.z>1){bubble.style.visibility='hidden';return;}
    const w=o.host.clientWidth,h=o.host.clientHeight,bw=bubble.offsetWidth,bh=bubble.offsetHeight;
    const x=Math.min(w-bw/2-8,Math.max(bw/2+8,(head.x+1)/2*w)),y=Math.min(h-8,Math.max(bh+8,(1-head.y)/2*h));
    bubble.style.visibility='visible';bubble.style.transform=`translate(${x-bw/2}px,${y-bh}px)`;
  }
  return {greet,hit,nearest,hide,
    update(active:boolean,at:T.Vector3){
      if(!current)return;
      const live=find(current.target.id);
      if(!active||!live||performance.now()>current.until||live.position.distanceTo(at)>22){hide();return;}
      current.target=live;if(o.isMuted())voice.stop();place();
    },
    state:()=>({open:!!current,npc:current?.target.id??null,lang:current?.phrase.lang??null,text:current?.phrase.text??null,occasion:current?.phrase.occasion??null,
      voices:{ja:voice.voiceName('ja'),vi:voice.voiceName('vi')},
      // QA only: where each visible NPC's chest is on screen.
      targets:o.targets().filter(t=>t.visible).map(t=>{head.copy(t.position);head.y+=t.height*.6;head.project(o.camera);const r=o.host.getBoundingClientRect();return {id:t.id,lang:t.lang,x:r.left+(head.x+1)/2*r.width,y:r.top+(1-head.y)/2*r.height,front:head.z<1};})})};
}
