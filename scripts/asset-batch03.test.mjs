import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),manifest=JSON.parse(await readFile(new URL('docs/assets/batch03/RUNTIME-MANIFEST.json',root),'utf8'));
test('scenery-only package preserves approved files and excludes withdrawn character assets',async()=>{
 assert.equal(manifest.assets.length,54);assert.equal(new Set(manifest.assets.map(a=>a.id)).size,54);
 assert.equal(manifest.assets.some(a=>a.category==='characters-npc'),false);
 for(const a of manifest.assets){
  const b=await readFile(new URL('public/assets/batch03-r1/'+a.file,root));assert.equal(b.length,a.bytes,a.id);assert.equal(createHash('sha256').update(b).digest('hex'),a.sha256,a.id);
  assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(8),b.length);const j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
  assert.ok([...(j.images||[]),...(j.buffers||[])].every(r=>!r.uri||r.uri.startsWith('data:')),a.id);
 }
});
test('CP01 Recovery retains the three approved hashes without silhouette edits',()=>{
 const hashes=['2bf7bc0715fd3c6c6480694bef8850710b9b81892f0f8b851ff75df22bb5c966','4bc7cdf8706257e4cc779682b95f61474b2bf7716d8be2af3d2e6f438b2494a2','c2bf4b57f15e23e615d559308a445310d0dfd10c1f188218ee50d79044248ddc'];
 hashes.forEach((hash,i)=>assert.equal(manifest.assets.find(a=>a.id===`CP01-recovered-LOD${i}`).sha256,hash));
});
