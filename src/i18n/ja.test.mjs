import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync,statSync} from 'node:fs';import path from 'node:path';
import {JA} from './ja.ts';
const VN=/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1')),'..');
const files=[];(function walk(d){for(const f of readdirSync(d)){const p=path.join(d,f);if(statSync(p).isDirectory())walk(p);else if(/\.ts$/.test(f)&&!/\.test\./.test(f))files.push(p);}})(root);
const unescape=s=>s.replace(/\\n/g,'\n').replace(/\\'/g,"'").replace(/\\\\/g,'\\');
const used=new Map();
for(const f of files){const src=readFileSync(f,'utf8');if(!/import \{[^}]*\btr\b[^}]*\} from '[^']*i18n(\/index\.ts)?'/.test(src)&&!/const tr=options\.tr/.test(src))continue;
  for(const m of src.matchAll(/\btr\('((?:\\.|[^'\\])*)'/g)){const k=unescape(m[1]);if(!used.has(k))used.set(k,path.relative(root,f));}}
// Server error messages (all modules) are shown through trServer(); they count as used.
const serverDir=path.join(root,'..','server');
const serverMsgs=[...new Set(readdirSync(serverDir).filter(f=>f.endsWith('.mjs')&&!f.includes('test')).flatMap(f=>[...readFileSync(path.join(serverDir,f),'utf8').matchAll(/fail\(\d+,\s*'[A-Z_]+',\s*'((?:\\'|[^'])+)'\)|\b(?:message|error):\s*'((?:\\'|[^'])*[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ](?:\\'|[^'])*)'/g)].map(m=>m[1]??m[2])))];
for(const m of serverMsgs)if(!used.has(m))used.set(m,'server');
// Client-side Error('…') messages are displayed through trServer() too.
for(const f of files)if(!/batch03/.test(f))for(const m of readFileSync(f,'utf8').matchAll(/Error\(\s*'([^']+)'\s*\)/g))if(VN.test(m[1])&&!used.has(m[1]))used.set(m[1],path.relative(root,f));
// Proper names that legitimately keep Vietnamese letters in Japanese text.
const NAMES=/Kiên|Đạt|Quân/g;
test('every wrapped UI string has a Japanese translation',()=>{
  const missing=[...used].filter(([k])=>VN.test(k)&&!(k in JA)).map(([k,f])=>`${f}: ${k}`);
  assert.deepEqual(missing,[],`missing ${missing.length}:\n`+missing.slice(0,30).join('\n'));
  assert(used.size>=500,'phase 1 covers at least 500 strings');
});
test('translations are Japanese, keep placeholders, and contain no Vietnamese leftovers',()=>{
  for(const [vi,ja] of Object.entries(JA)){
    assert(!VN.test(ja.replace(NAMES,'')),`Vietnamese left in: ${ja}`);
    const ph=s=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join();assert.equal(ph(ja),ph(vi),`placeholders differ: ${vi}`);
    if(VN.test(vi.replace(NAMES,'')))assert(/[\u3040-\u30ff\u4e00-\u9faf]/.test(ja),`not Japanese: ${vi} → ${ja}`);
    assert(!/[<>]/.test(ja)||/[<>]/.test(vi),`markup introduced: ${ja}`);
  }
});
test('no stale entries pile up unnoticed',()=>{
  const stale=Object.keys(JA).filter(k=>!used.has(k));
  assert(stale.length<=40,`stale entries: ${stale.slice(0,20).join(' | ')}`);
});

test('short Japanese wishes are accepted, Vietnamese keeps the 10-character rule, client and server agree',async()=>{
  const {minMessageLength:client}=await import('./index.ts');const {minMessageLength:server}=await import('../../server/app.mjs');
  for(const [text,min] of [['先生、ありがとう',5],['ありがとう',5],['Cảm ơn thầy',10],['Thank you!',10],['Cảm ơn 先生',5]]){assert.equal(client(text),min,text);assert.equal(server(text),min,text);}
  assert([...'先生、ありがとう'].length>=client('先生、ありがとう'));assert([...'Cảm ơn ạ'].length<client('Cảm ơn ạ'));
});
test('every server error message (all modules) has a Japanese translation',()=>{
  assert(serverMsgs.length>100);assert.deepEqual(serverMsgs.filter(m=>!(m in JA)),[]);
  const src=readFileSync(path.join(root,'..','server','app.mjs'),'utf8');
  const msgs=[...new Set([...src.matchAll(/fail\(\d+,'[A-Z_]+','((?:\\'|[^'])+)'\)/g)].map(m=>m[1]))].filter(m=>!/npm run build|closingAt/.test(m));
  const missing=msgs.filter(m=>!(m in JA));assert.deepEqual(missing,[]);
});
test('every reflection entry has a Japanese overlay marked as an AI translation',async()=>{
  const {REFLECTIONS_JA}=await import('../reflections/board-content-ja.ts');
  const approved=(await import('../reflections/board-content-approved.ts')).default,preview=(await import('../reflections/board-content-preview.ts')).default;
  const ids=new Set([...approved,...preview].map(e=>e.id));
  for(const id of ids)assert(REFLECTIONS_JA[id],`missing overlay for ${id}`);
  for(const [id,o] of Object.entries(REFLECTIONS_JA)){
    assert(ids.has(id),`overlay for unknown entry ${id}`);
    assert(o.type.includes('AI訳'),`${id} must say it is an AI translation`);
    for(const f of ['title','content','question'])assert(/[\u3040-\u30ff\u4e00-\u9faf]/.test(o[f])&&!VN.test(o[f]),`${id}.${f} not Japanese`);
  }
  // Author line: the author's own name stays as written; any Vietnamese around it is translated.
  for(const e of [...approved,...preview]){const author=REFLECTIONS_JA[e.id]?.author??e.author;
    assert(!VN.test(author),`${e.id}.author has untranslated Vietnamese: ${author}`);}
});
test('Vietnamese NPC lines and occasion labels have Japanese meanings',async()=>{
  const m=await import('../play/npcPhrases.ts');
  for(const p of [m.GREETINGS.vi,...m.PHRASES.filter(p=>p.lang==='vi')])assert(p.text in JA,`NPC line: ${p.text}`);
  for(const l of Object.values(m.OCCASION_LABELS))assert(l in JA,`occasion: ${l}`);
});
import {breakUnits,joinUnits,wrapUnits} from './lineBreak.ts';
test('canvas line breaks: Vietnamese at spaces, Japanese between characters with kinsoku',()=>{
 assert.deepEqual(breakUnits('Tôn sư trọng đạo').map(u=>u.t),['Tôn','sư','trọng','đạo']);
 const ja='まず礼を学び、のちに「文」を学ぶ。';
 const u=breakUnits(ja);assert.equal(joinUnits(u),ja);
 assert(u.every(x=>!/^[、。」ー]/.test(x.t)),'no closing mark starts a unit');
 assert(u.every(x=>!/「$/.test(x.t)),'no opening bracket ends a unit');
 assert(breakUnits('『Nghề thầy（教師という仕事）』').some(x=>x.t.includes('Nghề')),'Latin word stays whole');
 const lines=wrapUnits('教師は知識を伝えるだけでなく、学ぶ者の人格の形成にも力を尽くす存在である。',10,s=>[...s].length);
 assert(lines.length>3&&lines.every(l=>[...l].length<=10));assert.equal(lines.join(''),'教師は知識を伝えるだけでなく、学ぶ者の人格の形成にも力を尽くす存在である。');
});
test('client error messages thrown in Vietnamese have a Japanese translation (review-only batch03 pages excepted)',()=>{
 const missing=[];
 for(const f of files){if(/batch03/.test(f))continue;const s=readFileSync(f,'utf8');for(const m of s.matchAll(/Error\(\s*'([^']+)'\s*\)/g))if(VN.test(m[1])&&!(m[1] in JA))missing.push(`${path.basename(f)}: ${m[1]}`);}
 assert.deepEqual(missing,[]);
});
