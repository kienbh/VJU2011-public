import test from 'node:test';
import assert from 'node:assert/strict';
import {cardTextLines} from './cardText.ts';
const width = text => [...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)].length;
test('Japanese and long unbroken card text wraps at readable size, truncates within width',()=>{
 for(const text of ['先生、いつもご指導ありがとうございます。'.repeat(5),'A'.repeat(1000)]) {
  const lines=cardTextLines(text,width,12,5);
  assert.equal(lines.length,5); assert.ok(lines.every(line=>width(line)<=12)); assert.ok(lines.at(-1).endsWith('…'));
 }
});
test('card wrapping keeps whole words, Vietnamese accents and joined emoji',()=>{
 assert.deepEqual(cardTextLines('Cảm ơn thầy cô',width,7,4),['Cảm ơn','thầy cô']);
 assert.deepEqual(cardTextLines('a\u0301👩‍🏫a\u0301👩‍🏫',width,2,3),['a\u0301👩‍🏫','a\u0301👩‍🏫']);
 assert.deepEqual(cardTextLines('   ',width,10,5),[]);
});
