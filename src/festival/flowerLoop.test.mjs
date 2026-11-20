import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('./flowerLoop.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
const {createFlowerLoop,readFlowerLoop,advanceFlowerLoop,pickFlower,removeFlower,plantFlowers,clearBasket,flowerLabel}=await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`);
test('59/60 seconds and three refill cycles retain basket and named planted flowers',()=>{
 let s=createFlowerLoop(0);s=pickFlower(s,'rose',0).state;s=pickFlower(s,'daisy',0).state;
 s=plantFlowers(s,2,'plant-1',1,'Người thử','Thầy cô thử').state;
 for(let cycle=0;cycle<3;cycle++){
  s=pickFlower(s,'sunflower',cycle*60000+2).state;
  const basket=[...s.basket],planted=structuredClone(s.planted);
  const before=advanceFlowerLoop(s,cycle*60000+59999);assert.equal(before.stock.sunflower,15);
  s=advanceFlowerLoop(before,(cycle+1)*60000);assert.deepEqual(s.stock,{rose:16,daisy:16,sunflower:16,cosmos:16,lavender:16,tulip:16,lotus:16,chrysanthemum:16,bidens:16});assert.deepEqual(s.basket,basket);assert.deepEqual(s.planted,planted);
 }
});
test('sleep and repeated updates reset stock once, never add carried or planted flowers',()=>{
 let s=pickFlower(createFlowerLoop(0),'rose',1).state;s=plantFlowers(s,0,'sleep',2,'A','B').state;s=pickFlower(s,'daisy',3).state;
 const after=advanceFlowerLoop(s,3_600_000);assert.equal(after.stock.rose,16);assert.deepEqual(after.basket,['daisy']);assert.deepEqual(after.planted,s.planted);assert.strictEqual(advanceFlowerLoop(after,3_600_000),after);
});
test('occupied slot and retried planting do not consume another bouquet or duplicate plants',()=>{
 let s=pickFlower(createFlowerLoop(0),'rose',1).state;
 const first=plantFlowers(s,0,'intent',2,'A','B');assert.equal(first.ok,true);s=pickFlower(first.state,'daisy',3).state;
 const retry=plantFlowers(s,1,'intent',4);assert.equal(retry.duplicate,true);assert.equal(retry.slot,0);assert.deepEqual(retry.state.basket,['daisy']);
 const occupied=plantFlowers(s,0,'new-intent',5);assert.equal(occupied.reason,'occupied');assert.deepEqual(occupied.state.basket,['daisy']);assert.equal(occupied.state.planted.filter(Boolean).length,1);
});
test('remove and clear never refill stock; invalid flower and empty planting rejected',()=>{
 let s=pickFlower(createFlowerLoop(0),'rose',1).state;s=removeFlower(s,0,2).state;assert.equal(s.stock.rose,15);
 s=pickFlower(s,'rose',3).state;s=clearBasket(s,4).state;assert.equal(s.stock.rose,14);assert.equal(plantFlowers(s,0,'empty',4).reason,'basket-empty');assert.equal(pickFlower(s,'bad',4).reason,'invalid-flower');
});
test('local record roundtrip keeps types/names/slots, sanitizes controls and duplicate IDs',()=>{
 let s=pickFlower(createFlowerLoop(0),'sunflower',1).state;s=plantFlowers(s,5,'persist',2,'  Tên\n thử  ','Cô Á').state;
 const restored=readFlowerLoop(JSON.parse(JSON.stringify(s)),3);assert.deepEqual(restored.planted,s.planted);assert.equal(restored.planted[5].signature,'Tên thử');assert.equal(flowerLabel('abc\u202edef'),'abc def');
 const corrupt={...s,basket:['bad','rose'],planted:[s.planted[5],s.planted[5]],stock:{rose:-5,daisy:900,sunflower:'bad'}};const clean=readFlowerLoop(corrupt,4);assert.equal(clean.planted.filter(Boolean).length,1);assert.deepEqual(clean.stock,{rose:0,daisy:16,sunflower:0,cosmos:16,lavender:16,tulip:16,lotus:16,chrysanthemum:16,bidens:16});assert.deepEqual(clean.basket,['rose']);
});

test('new botanical species preserve the basket and migrate old local stock',()=>{
 let s=createFlowerLoop(0);const old=JSON.parse(JSON.stringify(s));delete old.stock.cosmos;delete old.stock.lavender;
 s=readFlowerLoop(old,1);assert.equal(s.stock.cosmos,16);assert.equal(s.stock.lavender,16);
 for(const kind of ['rose','daisy','sunflower','cosmos','lavender'])s=pickFlower(s,kind,2).state;
 assert.deepEqual(s.basket,['rose','daisy','sunflower','cosmos','lavender']);
 s=plantFlowers(s,0,'five-types',3,'Mẫu','Thầy cô').state;assert.equal(s.planted[0].flowers.length,5);
 const saved=readFlowerLoop(JSON.parse(JSON.stringify(s)),60000);assert.deepEqual(saved.planted,s.planted);assert.deepEqual(saved.basket,[]);assert.equal(saved.stock.lavender,16);
});
