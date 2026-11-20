import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import ts from 'typescript';
import {shortcutIndex} from './routeProgress.ts';
async function moduleUrl(file,replacements={}){let source=await readFile(new URL(file,import.meta.url),'utf8');for(const [from,to] of Object.entries(replacements))source=source.replaceAll(from,to);return 'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');}
const collisionUrl=await moduleUrl('../player/collision.ts');
const {isWalkable}=await import(collisionUrl);
const {createRoutePlanner,ROUTE_RADIUS}=await import(await moduleUrl('./routePlanner.ts',{'../player/collision':collisionUrl}));
const bounds={minX:-30,maxX:30,minZ:-30,maxZ:30};
function assertSafe(route,colliders){assert(route.length>=2);for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],n=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.1);for(let j=0;j<=n;j++)assert(isWalkable({x:a.x+(b.x-a.x)*j/(n||1),z:a.z+(b.z-a.z)*j/(n||1)},colliders,bounds,ROUTE_RADIUS));}}
test('route chooses a longer built path over the empty-lawn shortcut, even after smoothing',()=>{
 const start={x:-12,z:0},end={x:12,z:0};const lane={width:4,points:[start,{x:-12,z:10},{x:12,z:10},end]};
 const route=createRoutePlanner([],bounds,[lane]).find(start,end);assertSafe(route,[]);assert(route.some(p=>p.z>8));
 const length=route.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-route[i].x,p.z-route[i].z),0);assert(length>32);
});
test('buildings override preferred paving and diagonal corners keep avatar/ribbon clearance',()=>{
 const walls=[{minX:-5,maxX:5,minZ:-8,maxZ:8}],start={x:-20,z:0},end={x:20,z:0};
 const planner=createRoutePlanner(walls,bounds,[{points:[start,end],width:6}],[bounds]);const route=planner.find(start,end);assertSafe(route,walls);assert(route.some(p=>Math.abs(p.z)>9));
});
test('fences and shoreline polygons cannot be cut through',()=>{
 const blockers=[{minX:0,maxX:12,minZ:0,maxZ:15,polygon:[[0,0],[12,0],[6,15]]},{minX:-3,maxX:-3,minZ:-12,maxZ:16,segment:[-3,-12,-3,16],thickness:.23}];
 assertSafe(createRoutePlanner(blockers,bounds).find({x:-16,z:4},{x:20,z:4}),blockers);
});
test('no route across a sealed barrier, and a blocked endpoint is not silently relocated',()=>{
 const walls=[{minX:-1,maxX:1,minZ:-30,maxZ:30}],planner=createRoutePlanner(walls,bounds);
 assert.deepEqual(planner.find({x:-10,z:0},{x:10,z:0}),[]);assert.deepEqual(planner.find({x:0,z:0},{x:10,z:0}),[]);assert.deepEqual(planner.find({x:10,z:0},{x:0,z:0}),[]);
});
test('new colliders invalidate cached free cells and the resulting detour stays safe',()=>{
 const walls=[],planner=createRoutePlanner(walls,bounds);planner.find({x:-15,z:0},{x:15,z:0});walls.push({minX:-4,maxX:4,minZ:-7,maxZ:7});assertSafe(planner.find({x:-15,z:0},{x:15,z:0}),walls);
});
test('route progress keeps walkway corners even when the destination is directly visible',()=>{
 const route=[{x:0,z:0},{x:0,z:10},{x:15,z:10},{x:15,z:0}];
 assert.equal(shortcutIndex({x:0,z:2},route,()=>true),1);assert.equal(shortcutIndex({x:0,z:9.5},route,()=>true),2);assert.equal(shortcutIndex({x:8,z:10},route,()=>true),2);
 assert.equal(shortcutIndex({x:0,z:2},route,()=>false),-1);
});
