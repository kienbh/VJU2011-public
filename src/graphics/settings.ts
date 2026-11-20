import {tr} from '../i18n/index.ts';
import {SETTINGS_KEY,readQuality,type Quality} from './policy';
export function loadQuality():Quality{if(typeof location!=='undefined'&&new URLSearchParams(location.search).get('safe3d')==='1')return 'economy';try{return readQuality(JSON.parse(localStorage.getItem(SETTINGS_KEY)||'null'));}catch{return 'auto';}}
export function saveGraphics(patch:Record<string,unknown>){
  let old:Record<string,unknown>={};
  try{const value=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))old=value;}catch{/* Recover corrupt JSON on the next explicit choice. */}
  try{
    localStorage.setItem(SETTINGS_KEY,JSON.stringify({...old,...patch}));
  }catch{/* A blocked/full store must not prevent changing quality for this session. */}
}
export function saveQuality(quality:Quality){saveGraphics({quality});}
export function loadGraphics():Record<string,unknown>{try{const v=JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}");return v&&typeof v==="object"&&!Array.isArray(v)?v:{};}catch{return {};}}
export function mountQualityChoice(root:HTMLElement,select:(value:Quality)=>void,current:Quality){
  const label=document.createElement('label');label.className='graphics-choice';
  label.innerHTML=`<span>${tr('Mức đồ hoạ')}</span><select aria-label="${tr('Mức đồ hoạ')}"><option value="auto">${tr('Tự động')}</option><option value="beautiful">${tr('Đẹp')}</option><option value="balanced">${tr('Cân bằng')}</option><option value="economy">${tr('Tiết kiệm')}</option></select><small>${tr('Ưu tiên chữ rõ; tự giảm chi tiết khi máy chạy chậm.')}</small>`;
  const input=label.querySelector('select')!;input.value=current;
  input.onchange=()=>select(readQuality({quality:input.value}));root.append(label);
}
