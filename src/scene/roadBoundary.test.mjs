import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {roadBoundary,pavingOutsideRoads} from './roadBoundary.ts';
import polygonClipping from 'polygon-clipping';
import {roundedRoad,roundedJunction} from './roads.ts';
const material=new THREE.MeshBasicMaterial();

test('GD2 paving leaves both the straight lane and rounded corner clear',()=>{
 const scene=new THREE.Group();scene.add(roundedRoad('rear',[[-81,52],[-81,-42],[-88,-52],[-88,-88],[84,-88]],6,material,5),roundedRoad('front',[[-81,-30],[84,-30]],6,material));
 const slab=[[[-79,-37.5],[79,-37.5],[79,-33],[-79,-33],[-79,-37.5]]];
 const clipped=pavingOutsideRoads(slab,scene),{roadPolygons,surfacePatches,spans}=roadBoundary(scene);
 const asphalt=polygonClipping.union(roadPolygons,...surfacePatches.map(r=>[r]));
 assert.ok(polygonClipping.intersection(slab,asphalt).length,'old rectangle really overlaps asphalt');
 assert.deepEqual(polygonClipping.intersection(clipped,asphalt),[],'new paving leaves asphalt including corner clear');
 for(const {corners:[a,b,c,d]} of spans)assert.deepEqual(polygonClipping.intersection(clipped,[[a,b,d,c,a]]),[],'paving stays outside white paint');
 const retained=[[[-70,-37.5],[70,-37.5],[70,-33],[-70,-33],[-70,-37.5]]];
 assert.deepEqual(polygonClipping.difference(retained,clipped),[],'straight frontage retains its existing width');
});

test('T junction has one continuous perimeter and no stripe across its mouth',()=>{
 const scene=new THREE.Group();scene.add(roundedRoad('main',[[-20,0],[20,0]],8,material),roundedRoad('branch',[[0,0],[0,20]],6,material),roundedJunction('corner',0,0,{east:8,west:8,south:6},material,3));
 const {spans,contours}=roadBoundary(scene);assert.equal(contours.length,1);
 for(const {a,b} of spans){const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];assert.ok(!(Math.abs(mid[0])<2.6&&mid[1]>3.5&&mid[1]<4.5),'no internal cap/edge across branch');}
 // All unpaired paint endpoints belong to one of the three open road ends.
 const counts=new Map();for(const {a,b} of spans)for(const p of [a,b]){const k=p.map(v=>v.toFixed(5)).join(',');counts.set(k,(counts.get(k)||0)+1);}
 const ends=[...counts].filter(([,count])=>count===1);assert.equal(ends.length,6);
 for(const [key] of ends){const [x,z]=key.split(',').map(Number);assert.ok(Math.abs(x)>19||z>19);}
});

test('duplicate ribbon and touching junction surfaces produce no duplicate paint',()=>{
 const scene=new THREE.Group();scene.add(roundedRoad('main',[[-20,0],[20,0]],8,material),roundedRoad('duplicate',[[-8,0],[8,0]],8,material));
 const {spans,contours}=roadBoundary(scene);assert.equal(contours.length,1);
 assert.ok(spans.every(({a,b})=>Math.abs(a[1])>3.5&&Math.abs(b[1])>3.5));
});

test('curved paint joins share exact vertices, including transformed road groups',()=>{
 const scene=new THREE.Group(),nested=new THREE.Group();nested.position.set(50,0,90);scene.add(nested);
 nested.add(roundedRoad('curve',[[0,0],[0,20],[20,20]],6,material,6));
 const {spans}=roadBoundary(scene);assert.ok(spans.length>10);
 for(const span of spans){assert.ok(span.corners.flat().every(Number.isFinite));assert.ok(span.a[0]>45&&span.a[1]>85);}
 for(const span of spans){const next=spans.find(v=>v!==span&&v.a[0]===span.b[0]&&v.a[1]===span.b[1]);if(next){assert.deepEqual(span.corners[1],next.corners[0]);assert.deepEqual(span.corners[3],next.corners[2]);}}
});
