import {JA} from './ja.ts';

/** Vietnamese / Japanese UI. The Vietnamese sentence is the key: tr('Gửi lời chúc') returns it unchanged in Vietnamese
 * and the Japanese entry in Japanese, so source code stays readable and a missing entry degrades to Vietnamese.
 * Language comes from ?lang=ja|vi for this URL, then an explicit language-button choice, then Vietnamese.
 * Campus switching reloads panels rendered once at mount; the entry screen repaints in place.
 * User-written content (cards, names) is never translated. */
export type Lang='vi'|'ja';
const KEY='vju2011-language-choice';
function detect():Lang{
  try{
    const asked=new URLSearchParams(location.search).get('lang');
    if(asked==='ja'||asked==='vi')return asked;
    const saved=localStorage.getItem(KEY);if(saved==='ja'||saved==='vi')return saved;
  }catch{/* storage or URL unavailable (tests) */}
  return 'vi';
}
export let LANG:Lang=typeof window==='undefined'?'vi':detect();
if(typeof document!=='undefined')document.documentElement.lang=LANG;
const missing=new Set<string>();
/** Translate a Vietnamese UI sentence; {0}, {name}… placeholders are filled from vars after translation. */
export function tr(text:string,vars?:Record<string|number,unknown>):string{
  let out=text;
  if(LANG==='ja'){const hit=JA[text];if(hit!==undefined)out=hit;else if(/\p{L}/u.test(text))missing.add(text);}
  if(vars)out=out.replace(/\{(\w+)\}/g,(m,k)=>k in vars?String(vars[k]??''):m);
  return out;
}
/** Server-stored constants shown back to users (e.g. the anonymous signature). Data stays Vietnamese; only display changes. */
const DATA_CONSTANTS=new Set(['Khách ẩn danh','Tập thể thầy cô và cán bộ nhân viên VJU','Một người bạn VJU','Sinh viên VJU','Bạn đọc VJU']);
export function tName(value:string):string{return DATA_CONSTANTS.has(value)?tr(value):value;}
export function setLang(next:Lang,options:{reload?:boolean}={}){
  try{localStorage.setItem(KEY,next);}catch{/* ignore */}
  const url=new URL(location.href);url.searchParams.set('lang',next);
  if(options.reload===false){
    // Before the campus mounts, the participation screen can repaint without another asset load.
    LANG=next;document.documentElement.lang=next;history.replaceState(null,'',url);return;
  }
  location.replace(url.toString());
}
/** Canvas/WebGL text: Japanese needs a CJK face; Vietnamese keeps the original stack first. */
export const JA_FONTS='"Hiragino Sans","Yu Gothic UI","Yu Gothic","Meiryo","Noto Sans JP","Noto Sans CJK JP"';
/** Append Japanese faces to a CSS font shorthand when the UI is Japanese (no change in Vietnamese). */
export function font(spec:string):string{return LANG==='ja'?spec.replace(/(sans-serif|serif)\s*$/,`${JA_FONTS}, $1`):spec;}
/** Server error messages are Vietnamese sentences (some composed: "{field} cần 1–{max} ký tự hợp lệ."). Translate for display. */
export function trServer(message:string):string{
  if(LANG!=='ja'||!message)return message;
  if(JA[message]!==undefined)return JA[message];
  let m=message.match(/^(.+) phải là văn bản\.$/);if(m)return `${tr(m[1])}は文字で入力してください。`;
  m=message.match(/^(.+) cần 1–(\d+) ký tự hợp lệ\.$/);if(m)return `${tr(m[1])}は1〜${m[2]}文字で入力してください。`;
  m=message.match(/^(.+) cần không quá (\d+) ký tự hợp lệ\.$/);if(m)return `${tr(m[1])}は${m[2]}文字以内で入力してください。`;
  return tr(message);
}
/** Japanese is dense: a short Japanese wish ("先生、ありがとう") must not be rejected by the 10-character rule. Mirrors the server. */
export function minMessageLength(text:string){return /[぀-ヿ㐀-鿿]/u.test(text)?5:10;}
export const i18nState=()=>({lang:LANG,missing:[...missing]});
