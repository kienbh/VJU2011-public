/** Break units for canvas wrapping. Vietnamese breaks at spaces; Japanese (no spaces) may break between characters,
 * with kinsoku rules: closing punctuation, ー and small kana never start a line, opening brackets never end one.
 * Latin words and numbers inside Japanese (proper names such as 『Nghề thầy』, dates such as 20.11) stay whole. */
export type BreakUnit={t:string;sep:string};
const CJK=/[　-ヿ㐀-鿿豈-﫿＀-￯]/;
const NO_START=new Set([...'、。，．・：；？！ー」』）】〕〉》ゝゞ々ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ…‥!?),.:;]}%']);
const NO_END=new Set([...'「『（【〔〈《([{“‘']);
export function breakUnits(text:string):BreakUnit[]{
  const out:BreakUnit[]=[];
  for(const word of text.split(/\s+/).filter(Boolean)){
    const sep=out.length?' ':'';
    if(!CJK.test(word)){out.push({t:word,sep});continue;}
    const tokens:string[]=[];let latin='';
    const flush=()=>{if(latin){tokens.push(latin);latin='';}};
    for(const ch of word){if(CJK.test(ch)||NO_START.has(ch)||NO_END.has(ch)){flush();tokens.push(ch);}else latin+=ch;}
    flush();
    const merged:string[]=[];
    for(const tok of tokens){const prev=merged[merged.length-1];
      if(prev!==undefined&&(NO_START.has(tok[0])||NO_END.has(prev[prev.length-1])))merged[merged.length-1]=prev+tok;else merged.push(tok);}
    merged.forEach((t,i)=>out.push({t,sep:i?'':sep}));
  }
  return out;
}
/** Join units back into a line (the first unit's separator is dropped). */
export function joinUnits(units:BreakUnit[]){return units.map((u,i)=>i?u.sep+u.t:u.t).join('');}
/** Greedy wrap: as many units per line as fit `width` according to `measure`. */
export function wrapUnits(text:string,width:number,measure:(s:string)=>number){
  const result:string[]=[];let line='';
  for(const u of breakUnits(text)){const next=line?line+u.sep+u.t:u.t;if(line&&measure(next)>width){result.push(line);line=u.t;}else line=next;}
  if(line)result.push(line);return result;
}
