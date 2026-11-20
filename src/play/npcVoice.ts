import type {NpcLang,Phrase} from './npcPhrases';

/** Device speech for NPC lines in the public edition; no recorded clips are distributed.
 * Uses the device's own voice for that language via the Web Speech API (iOS Kyoko/Linh, Android Google,
 *    Edge neural Nanami/HoaiMy), choosing the most natural voice available.
 * No voice for the language → stay silent (never read Japanese with a Vietnamese voice or vice versa); text still shows.
 * Speech starts only inside a user gesture, respects the game mute and stops when the tab is hidden. */
const LOCALE:Record<NpcLang,string>={ja:'ja-JP',vi:'vi-VN'};
const PREFERRED=/natural|neural|online|premium|enhanced|siri|google|nanami|keita|kyoko|otoya|hoaimy|namminh|linh/i;
export type VoiceStatus='speaking'|'muted'|'no-voice'|'unsupported';
export function createNpcVoice(isMuted:()=>boolean){
  const synth=typeof window!=='undefined'&&'speechSynthesis' in window?window.speechSynthesis:null;
  let voices:SpeechSynthesisVoice[]=[];
  const load=()=>{try{voices=synth?.getVoices()??[];}catch{voices=[];}};
  load();synth?.addEventListener?.('voiceschanged',load);
  function pick(lang:NpcLang){
    const own=voices.filter(v=>v.lang?.toLowerCase().replace('_','-').startsWith(lang));
    return own.sort((a,b)=>Number(PREFERRED.test(b.name))-Number(PREFERRED.test(a.name))||Number(b.lang===LOCALE[lang])-Number(a.lang===LOCALE[lang])||Number(b.localService)-Number(a.localService))[0]??null;
  }
  function stop(){try{synth?.cancel();}catch{/* ignore */}}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  function speak(p:Phrase):VoiceStatus{
    stop();if(isMuted())return 'muted';
    if(!synth||typeof SpeechSynthesisUtterance==='undefined')return 'unsupported';
    if(!voices.length)load();
    const voice=pick(p.lang);if(!voice)return 'no-voice';
    const u=new SpeechSynthesisUtterance(p.text);u.lang=voice.lang||LOCALE[p.lang];u.voice=voice;u.rate=p.lang==='ja'?.9:.95;u.pitch=1;u.volume=1;
    try{synth.speak(u);}catch{return 'unsupported';}
    return 'speaking';
  }
  return {speak,stop,voiceName:(lang:NpcLang)=>pick(lang)?.name??null};
}
