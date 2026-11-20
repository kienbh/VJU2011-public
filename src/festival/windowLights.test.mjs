import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import ts from 'typescript';
const source=await readFile(new URL('./windowLights.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("from 'three'",`from '${import.meta.resolve('three')}'`);
const {createWindowLights}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
test('festival window materials restore original day values without affecting walls',()=>{
 const originalDocument=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>({createLinearGradient:()=>({addColorStop(){}}),fillRect(){}})})};
 try{
  const scene=new THREE.Group(),glass=new THREE.MeshStandardMaterial({emissive:'#123456',emissiveIntensity:.21}),map=new THREE.Texture(),wall=new THREE.MeshStandardMaterial();
  glass.name='campus-window-glass';glass.emissiveMap=map;
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(),glass),new THREE.Mesh(new THREE.BoxGeometry(),glass),new THREE.Mesh(new THREE.BoxGeometry(),wall));
  const lights=createWindowLights(scene);assert.equal(lights.count,1);
  lights.setEnabled(true);assert.notEqual(glass.emissiveMap,map);assert.equal(wall.emissive.getHex(),0);
  lights.setEnabled(false);assert.equal(glass.emissive.getHex(),0x123456);assert.equal(glass.emissiveIntensity,.21);assert.equal(glass.emissiveMap,map);
 }finally{globalThis.document=originalDocument;}
});
