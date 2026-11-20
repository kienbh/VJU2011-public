import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import approved from '../src/reflections/board-content-approved.ts';
import {REFLECTIONS_JA} from '../src/reflections/board-content-ja.ts';
const source=JSON.parse(readFileSync(new URL('../content/reflections/original-public.json',import.meta.url),'utf8'));

test('both public playlists contain the complete original replacement copy',()=>{
 assert.equal(source.length,11);assert.equal(approved.length,source.length);
 source.forEach((row,i)=>{
  const entry=approved[i],ja=REFLECTIONS_JA[entry.id];
  assert.equal(entry.title,row.title);assert.equal(entry.content,row.content);
  assert.equal(entry.question,row.question);assert.equal(entry.author,'VJU2011');
  assert.equal(ja.title,row.jaTitle);assert.equal(ja.content,row.jaContent);
  assert.equal(ja.question,row.jaQuestion);
 });
});

test('public runtime has a project mark and no stock pet requests or production metadata',()=>{
 assert(existsSync(new URL('../public/assets/brand/project-mark.svg',import.meta.url)));
 assert(!existsSync(new URL('../public/assets/brand/vju-logo.png',import.meta.url)));
 assert(!existsSync(new URL('../public/assets/audio/pets',import.meta.url)));
 assert(!existsSync(new URL('../public/assets/batch03-r1/assets/characters-npc',import.meta.url)));
 const audio=readFileSync(new URL('../src/audio/sound.ts',import.meta.url),'utf8');
 assert(!audio.includes('/assets/audio/pets/'));
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert(!/https?:\/\//.test(html.replace('http://www.w3.org/2000/svg','')));
});
