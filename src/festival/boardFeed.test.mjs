import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const helper=ts.transpileModule(await readFile(new URL('../browserCompat.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const helperUrl='data:text/javascript;base64,'+Buffer.from(helper).toString('base64');
const source=(await readFile(new URL('./boardFeed.ts',import.meta.url),'utf8')).replace("'../browserCompat'",JSON.stringify(helperUrl));
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
const {createBoardPager,loadPublicBoardPage}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputText).toString('base64'));
const page=n=>({page:n,pageSize:24,pages:2,total:48,greetings:[{id:'id'+n,message:'Cảm ơn',recipientName:'Thầy cô',signature:'Mẫu'}]});
const flush=()=>new Promise(r=>setImmediate(r));
test('ordered board advances at 10s, manual click resets deadline and wraps',async()=>{
 let now=0;const calls=[],shown=[];const p=createBoardPager({load:async n=>{calls.push(n);return page(n)},change:v=>shown.push(v.page),status:()=>{},now:()=>now});
 p.tick(now,true);await flush();assert.deepEqual(calls,[0]);now=9999;p.tick(now,true);assert.equal(calls.length,1);
 now=10000;p.tick(now,true);await flush();assert.deepEqual(shown,[0,1]);now=13000;await p.next();assert.deepEqual(shown,[0,1,0]);
 now=22999;p.tick(now,true);assert.equal(calls.length,3);now=23000;p.tick(now,true);await flush();assert.deepEqual(shown,[0,1,0,1]);
});
test('paused board never catches up and requests cannot overlap',async()=>{
 let now=0,resolve,calls=0;const p=createBoardPager({load:()=>{calls++;return new Promise(r=>resolve=r)},change:()=>{},status:()=>{},now:()=>now});
 p.tick(0,true);p.next();p.next();assert.equal(calls,1);resolve(page(0));await flush();
 now=5000;p.tick(now,false);now=90000;p.tick(now,false);p.tick(now,true);assert.equal(calls,1);
 now=99999;p.tick(now,true);assert.equal(calls,1);now=100000;p.tick(now,true);assert.equal(calls,2);resolve(page(1));await flush();
});
test('failed advance keeps the last page and retries; empty public list clears cards',async()=>{
 let now=0,fail=false,empty=false;const shown=[];const p=createBoardPager({load:async n=>{if(fail)throw Error('Mất kết nối');return empty?{page:0,pageSize:24,pages:1,total:0,greetings:[]}:page(n)},change:v=>shown.push(v),status:()=>{},now:()=>now});
 p.tick(0,true);await flush();fail=true;now=10000;p.tick(now,true);await flush();assert.deepEqual(p.state().ids,['id0']);assert.match(p.state().error,/Mất/);
 fail=false;now=20000;p.tick(now,true);await flush();assert.deepEqual(p.state().ids,['id1']);
 empty=true;await p.next();assert.deepEqual(p.state().ids,[]);assert.equal(shown.at(-1).total,0);
});
test('HTML, network failures and malformed page are reported without accepting cards',async t=>{
 const previous=globalThis.fetch;t.after(()=>globalThis.fetch=previous);
 globalThis.fetch=async()=>new Response('<html>',{headers:{'Content-Type':'text/html'}});await assert.rejects(loadPublicBoardPage(0),/Chưa tải/);
 globalThis.fetch=async()=>{throw new TypeError('Failed to fetch')};await assert.rejects(loadPublicBoardPage(0),/Mất kết nối/);
 globalThis.fetch=async()=>new Response('{bad',{headers:{'Content-Type':'application/json'}});await assert.rejects(loadPublicBoardPage(0),/định dạng/);
 globalThis.fetch=async()=>Response.json({...page(0),pageSize:1000});await assert.rejects(loadPublicBoardPage(0),/định dạng/);
 globalThis.fetch=async()=>Response.json(page(0));assert.deepEqual(await loadPublicBoardPage(0),page(0));
});
