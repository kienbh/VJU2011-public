import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('./collision.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { isWalkable, moveWithCollisions } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`);

const bounds = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };
const building = [{ minX: 0, maxX: 20, minZ: 0, maxZ: 20 }];

test('shoreline polygon allows dry land inside its bounding box and prevents water entry',()=>{
 const lake=[{minX:0,maxX:20,minZ:0,maxZ:20,polygon:[[0,0],[20,0],[0,20]]}];
 assert.equal(isWalkable({x:18,z:18},lake,bounds),true);
 assert.equal(isWalkable({x:2,z:2},lake,bounds),false);
 assert.equal(isWalkable({x:10,z:10.3},lake,bounds),false);
 assert.ok(isWalkable(moveWithCollisions({x:18,z:18},{x:-15,z:-15},lake,bounds),lake,bounds));
});
test('diagonal fence blocks the actual segment without filling the entire bounding box',()=>{
 const fence=[{minX:0,maxX:20,minZ:0,maxZ:20,segment:[0,0,20,20],thickness:.23}];
 assert.equal(isWalkable({x:1,z:18},fence,bounds),true);
 assert.equal(isWalkable({x:10,z:10},fence,bounds),false);
});

test('free movement keeps requested distance', () => {
  const next = moveWithCollisions({ x: -10, z: -10 }, { x: 3, z: 4 }, [], bounds);
  assert.ok(Math.abs(next.x + 7) < 1e-8 && Math.abs(next.z + 6) < 1e-8);
});
test('large step cannot tunnel through a building', () => {
  const next = moveWithCollisions({ x: -5, z: 10 }, { x: 60, z: 0 }, building, bounds);
  assert.ok(next.x < -0.649 && next.x > -0.66);
  assert.ok(isWalkable(next, building, bounds));
});
test('diagonal motion slides along wall without getting stuck', () => {
  const next = moveWithCollisions({ x: -2, z: 4 }, { x: 12, z: 10 }, building, bounds);
  assert.ok(next.x < -0.649);
  assert.ok(Math.abs(next.z - 14) < 1e-8);
});
test('walking beyond an outside corner clears wall naturally', () => {
  let next = { x: -0.65, z: 18 };
  for (let i = 0; i < 120; i++) next = moveWithCollisions(next, { x: 0.1, z: 0.1 }, building, bounds);
  assert.ok(next.x > 7 && next.z > 29);
  assert.ok(isWalkable(next, building, bounds));
});
test('world boundaries stop player footprint', () => {
  const next = moveWithCollisions({ x: 98, z: 98 }, { x: 10, z: 10 }, [], bounds);
  assert.ok(next.x <= 99.35 && next.z <= 99.35);
  assert.ok(next.x > 99.34 && next.z > 99.34);
});
test('diagonal corner approach never penetrates', () => {
  let next = { x: -6, z: -6 };
  for (let i = 0; i < 200; i++) {
    next = moveWithCollisions(next, { x: 0.15, z: 0.15 }, building, bounds);
    assert.ok(isWalkable(next, building, bounds));
  }
});
