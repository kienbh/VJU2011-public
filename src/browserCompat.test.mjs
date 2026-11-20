import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('./browserCompat.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {requestTimeout,roundedRectPath}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('missing native timeout still aborts a pending request',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(AbortSignal,'timeout');
 Object.defineProperty(AbortSignal,'timeout',{value:undefined,configurable:true});
 try{const signal=requestTimeout(10);assert.equal(signal.aborted,false);await new Promise(r=>signal.addEventListener('abort',r,{once:true}));assert.equal(signal.aborted,true);}
 finally{Object.defineProperty(AbortSignal,'timeout',descriptor);}
});
test('native rounded rectangle is retained when supported',()=>{
 let args;roundedRectPath({roundRect(...a){args=a;}},2,3,80,40,12);assert.deepEqual(args,[2,3,80,40,12]);
});
test('fallback makes a closed bounded label path without canvas roundRect',()=>{
 const calls=[];const ctx=Object.fromEntries(['moveTo','lineTo','quadraticCurveTo','closePath'].map(k=>[k,(...args)=>calls.push([k,...args])]));
 roundedRectPath(ctx,2,3,80,40,100);
 assert.deepEqual(calls[0],['moveTo',22,3]);assert.deepEqual(calls.at(-1),['closePath']);
 assert.equal(calls.filter(c=>c[0]==='quadraticCurveTo').length,4);
 for(const [, ...coords] of calls)for(let i=0;i<coords.length;i++)assert.ok(coords[i]>=(i%2?3:2)&&coords[i]<=(i%2?43:82));
});
