import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('./appearance.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
const {readAppearance,DEFAULT_APPEARANCE}=await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`);
test('invalid saved character data falls back without leaking extra fields',()=>{
  for(const v of [null,undefined,'bad',42,[],{body:'bad',hair:'bad',outfit:'bad',palette:-1,private:'discard'}])assert.deepEqual(readAppearance(v),DEFAULT_APPEARANCE);
  for(const palette of [NaN,Infinity,3,1.5,'1'])assert.equal(readAppearance({palette}).palette,0);
});
test('all supported character combinations survive saved data round trip',()=>{
  for(const body of ['male','female'])for(const hair of ['short','bob','ponytail'])for(const outfit of ['casual','polo','vju'])for(const palette of [0,1,2]){
    const v={body,hair,outfit,palette};assert.deepEqual(readAppearance(JSON.parse(JSON.stringify(v))),v);
  }
});
