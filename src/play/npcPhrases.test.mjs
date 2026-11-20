import test from 'node:test';import assert from 'node:assert/strict';
import {PHRASES,GREETINGS,OCCASION_LABELS,occasionsOn,npcDeck} from './npcPhrases.ts';
const at=(y,m,d,h=10)=>new Date(y,m-1,d,h);
test('every Japanese line has a reading and a Vietnamese meaning; every occasion has a label',()=>{
 for(const p of [...PHRASES,GREETINGS.ja])if(p.lang==='ja'){assert(p.reading&&p.meaning,p.text);assert(/[぀-ヿ一-龯]/.test(p.text),'Japanese script: '+p.text);}
 for(const p of PHRASES)if(p.occasion)assert(OCCASION_LABELS[p.occasion],p.occasion);
 for(const id of Object.keys(OCCASION_LABELS))for(const lang of ['ja','vi'])if(id!=='women2010'||lang==='vi')assert(PHRASES.some(p=>p.occasion===id&&p.lang===lang),`${id}/${lang}`);
});
test('occasions follow the calendar, including the lunar new year table',()=>{
 assert.deepEqual(occasionsOn(at(2026,11,20)),['teachers']);
 assert.deepEqual(occasionsOn(at(2026,12,24)),['christmas','yearEnd']);
 assert.deepEqual(occasionsOn(at(2027,1,1)),['newYear']);
 assert(occasionsOn(at(2027,2,6)).includes('tet'));assert(occasionsOn(at(2028,1,20)).includes('tet'));assert(!occasionsOn(at(2027,3,20)).includes('tet'));
 assert.deepEqual(occasionsOn(at(2027,3,8)),['women83']);assert.deepEqual(occasionsOn(at(2027,10,20)),['women2010']);assert.deepEqual(occasionsOn(at(2027,7,1)),[]);
});
test('neutral greeting stays the same at every device hour',()=>{
 for(const hour of [0,7,14,18,21,23]){
  assert.equal(npcDeck('vi',at(2026,11,18,hour))[0].text,'Xin chào!');
  assert.equal(npcDeck('ja',at(2026,11,18,hour))[0].text,'こんにちは！');
 }
});
test('deck opens with a neutral greeting and covers only current wishes and everyday lines',()=>{
 for(const lang of ['ja','vi']){
  const deck=npcDeck(lang,at(2026,11,18,9),3);
  assert.equal(deck[0].text,GREETINGS[lang].text);assert.equal(deck[1].occasion,'teachers');
  assert(deck.every(p=>p.lang===lang));
  const own=PHRASES.filter(p=>p.lang===lang&&(!p.occasion||p.occasion==='teachers'));assert.equal(deck.length,own.length+1);assert.equal(new Set(deck.slice(1)).size,own.length);
  assert(deck.every(p=>!p.occasion||p.occasion==='teachers'),'20/11 dialogue excludes New Year, Christmas and other holidays');
 }
 assert.notEqual(npcDeck('ja',at(2026,11,18),0)[5].text,npcDeck('ja',at(2026,11,18),1)[5].text,'seed rotates everyday lines between NPCs');
});

test('inactive holidays stay out of the whole dialogue loop in both languages',()=>{
 for(const lang of ['vi','ja'])for(const [date,allowed] of [
  [at(2026,11,18),['teachers']],[at(2026,12,24),['christmas','yearEnd']],
  [at(2027,1,1),['newYear']],[at(2027,3,8),['women83']],[at(2027,7,1),[]],
 ]){
  const deck=npcDeck(lang,date);
  assert(deck.every(p=>p.lang===lang&&(!p.occasion||allowed.includes(p.occasion))));
  assert.equal(new Set(deck.map(p=>p.text)).size,deck.length,'dialogue has no duplicate text');
  assert(deck.some(p=>!p.occasion&&p!==GREETINGS[lang]),'everyday conversation remains available');
 }
});
