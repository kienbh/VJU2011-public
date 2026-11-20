import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseReflectionContent,approvedBoardEntries} from './reflection-content.mjs';
const markdown=readFileSync(new URL('../content/reflections/goc-suy-ngam-nghe-thay.md',import.meta.url),'utf8');
const approval=JSON.parse(readFileSync(new URL('../content/reflections/board-publication.json',import.meta.url),'utf8'));
const generated=name=>JSON.parse(readFileSync(new URL(`../src/reflections/board-content-${name}.ts`,import.meta.url),'utf8').split('export default ')[1].trim().replace(/;$/,''));
test('board content is synchronized with the editorial source, including complete paragraphs and approval state',()=>{
 const entries=parseReflectionContent(markdown);
 assert.equal(entries.length,11);assert.equal(new Set(entries.map(e=>e.id)).size,11);
 assert.deepEqual(generated('preview'),entries);
 assert.deepEqual(generated('approved'),approvedBoardEntries(markdown,approval));
 assert.equal(generated('approved').length,11);
 assert.ok(entries.find(e=>e.id==='NT-005').content.includes('\n\n'));
 assert.ok(entries.every(e=>!e.content.includes('Lời dẫn / Bối cảnh')));
});
test('owner approval covers only the reviewed snapshot, not later draft edits',()=>{
 assert.equal(approvedBoardEntries(markdown,approval).length,11);
 assert.equal(approvedBoardEntries(markdown+'\nNew editorial content',approval).length,1);
 assert.equal(approvedBoardEntries(markdown,{...approval,sha256:'stale'}).length,1);
});
test('incomplete content fails validation and an unrecognized approval status never publishes',()=>{
 assert.throws(()=>parseReflectionContent(markdown.replace('**Câu hỏi suy ngẫm:**','**Câu hỏi thiếu:**')),/Incomplete reflection NT-001/);
 const entries=parseReflectionContent(markdown.replace('**Trạng thái:** Đã duyệt nội dung','**Trạng thái:** Chờ xác nhận'));
 assert.equal(entries.filter(e=>e.approved).length,0);
});
