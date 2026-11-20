import * as THREE from 'three';
import {createGuestHotel} from './hospitalityBuildings';
import { roundedRoad, ROAD_WIDTH } from './roads';
import { createSurfaceMaterial } from './surfaceMaterials';
import {createLakeWater,loadLakeshoreAsset} from './lakeWater';
import {createLakeShore} from './lakeShore';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {Collider} from '../types';

// Relative landmarks only; the lake and ridge are not surveyed outlines.
export const REAR_BACKDROP_DRAFT = {
  enabled: true,
  centerX: 0,
  frontZ: -139,
  rearGreenery: { x: 125, offsetZ: -47, width: 580, depth: 106, columns: 65 },
  ridge: { offsetZ: -255 },
  guestHouse: { x: 147, z: -184, width: 26, depth: 13, height: 5.5 },
} as const;
// Hand-traced relative shoreline from the labelled satellite image; not a surveyed boundary.
// The narrow land strip at x84 is kept open; the orange clubhouse sits on the south bank.
export const SATELLITE_LAKES = [
  {name:'lake-behind-lecture-blocks',points:[[-119,-147],[-112,-162],[-90,-166],[-67,-159],[-45,-147],[-16,-141],[15,-143],[52,-151],[72,-145],[76,-129],[71,-108],[48,-102],[10,-101],[-29,-103],[-67,-111],[-100,-122]]},
  {name:'lake-behind-dom',points:[[94,-143],[103,-164],[150,-167],[195,-165],[270,-161],[307,-157],[313,-144],[311,-78],[304,-72],[274,-79],[238,-90],[217,-104],[205,-114],[181,-131],[154,-130],[130,-134],[110,-138]]},
] as const;

// Walking and water geometry share exactly the same smoothed shoreline.
export const lakeOutline=(points:readonly (readonly [number,number])[])=>new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)),true,'centripetal').getSpacedPoints(180);
export const REAR_SCENERY_BLOCKERS:Collider[]=SATELLITE_LAKES.map(l=>{
  const polygon=lakeOutline(l.points).map(p=>[p.x,p.z] as const);
  return {minX:Math.min(...polygon.map(p=>p[0])),maxX:Math.max(...polygon.map(p=>p[0])),minZ:Math.min(...polygon.map(p=>p[1])),maxZ:Math.max(...polygon.map(p=>p[1])),polygon,maxY:.1,label:l.name};
});
REAR_SCENERY_BLOCKERS.push({minX:134,maxX:160,minZ:-190.5,maxZ:-177.5,maxY:13.5,label:'Nhà khách — nội thất chưa mở'});


export function createRearBackdrop() {
  const draft = REAR_BACKDROP_DRAFT;
  const group = new THREE.Group();
  group.name = 'rear-lake-and-mountain-context';
  group.visible = draft.enabled;
  group.position.set(draft.centerX, 0, draft.frontZ);
  group.userData = { provisional: true, navigable: false, role: 'two rear water areas and narrow land strip from labelled satellite' };
  const lakeshorePositions:THREE.Vector3[]=[];
  for(const lake of SATELLITE_LAKES){
    const outline=lakeOutline(lake.points),center=outline.reduce((a,p)=>a.add(p),new THREE.Vector3()).divideScalar(outline.length);
    for(const bank of [true,false]){
      const points=outline.map(p=>{const q=p.clone();if(bank)q.sub(center).multiplyScalar(1.025).add(center);return new THREE.Vector2(q.x,-q.z);});
      const geometry=new THREE.ShapeGeometry(new THREE.Shape(points));
      const mesh=bank?new THREE.Mesh(geometry,createSurfaceMaterial('grass',0x9aab80)):createLakeWater(geometry);
      mesh.rotation.x=-Math.PI/2;mesh.position.set(0,bank?.04:.064,-draft.frontZ);mesh.name=bank?`${lake.name}-bank`:lake.name;Object.assign(mesh.userData,{provisionalOutline:true,source:'Screenshot 2026-11-15 080818.png'});group.add(mesh);
    }
    // A feathered shallow-water tint lies wholly inside the existing shoreline.
    // It does not expand either lake or alter navigation blockers.
    const shorePositions:number[]=[],shoreColors:number[]=[],shoreIndices:number[]=[];
    outline.forEach((p,i)=>{
      const inside=p.clone().lerp(center,.035);
      shorePositions.push(p.x,.07,p.z-draft.frontZ,inside.x,.07,inside.z-draft.frontZ);
      const tint=new THREE.Color(0x75bcb7);shoreColors.push(tint.r,tint.g,tint.b,.28,tint.r,tint.g,tint.b,0);
      if(i<outline.length-1){const j=i*2;shoreIndices.push(j,j+2,j+1,j+1,j+2,j+3);}
    });
    const shoreGeometry=new THREE.BufferGeometry();shoreGeometry.setAttribute('position',new THREE.Float32BufferAttribute(shorePositions,3));shoreGeometry.setAttribute('color',new THREE.Float32BufferAttribute(shoreColors,4));shoreGeometry.setIndex(shoreIndices);
    const shore=new THREE.Mesh(shoreGeometry,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide}));shore.name=`${lake.name}-shallow-edge`;group.add(shore);
    for(const i of [15,51,99,137]){
      const p=outline[i].clone().sub(center).multiplyScalar(1.008).add(center);p.y=.065;p.z-=draft.frontZ;lakeshorePositions.push(p);
    }
  }
  loadLakeshoreAsset(group,lakeshorePositions);
  const planting=createLakeShore(SATELLITE_LAKES.map(lake=>lakeOutline(lake.points)));
  planting.position.z=-draft.frontZ;group.add(planting);

  // Extend the approved left backdrop across the full rear campus, outside play bounds.
  const greenery=draft.rearGreenery;
  const meadow=new THREE.Mesh(new THREE.PlaneGeometry(greenery.width,greenery.depth),createSurfaceMaterial('grass',0xacc193));
  meadow.rotation.x=-Math.PI/2;meadow.position.set(greenery.x,-.02,greenery.offsetZ);meadow.name='main-campus-rear-meadow';group.add(meadow);
  // Owner-circled VNU guest house: far bank, behind and slightly left of Club House.
  // Scenery mass only: dimensions, roof details and storey count are not surveyed.
  const guest=draft.guestHouse;
  const guestGroup=createGuestHotel();
  guestGroup.position.set(guest.x,0,guest.z-draft.frontZ);group.add(guestGroup);
  // Continue along the existing land strip and the far bank, never over water.
  // The access lane is walkable; lakes use their exact smoothed shoreline.
  const guestAccess=roundedRoad('guest-house-scenic-access',[
    [84,-132],[84,-176],[guest.x,-176],
  ],ROAD_WIDTH.access,createSurfaceMaterial('asphalt',0xc4cbd1),12);
  guestAccess.position.z=-draft.frontZ;
  // Ease the eight-unit campus spine down to the five-unit scenic lane.
  const accessVertices=guestAccess.geometry.getAttribute('position');
  const accessLine=guestAccess.userData.centerline as number[][];
  for(let i=0;i<accessLine.length;i++){
    const [x,z]=accessLine[i],t=THREE.MathUtils.clamp((-132-z)/14,0,1);
    const factor=THREE.MathUtils.lerp(ROAD_WIDTH.spine/ROAD_WIDTH.access,1,t*t*(3-2*t));
    for(const side of [0,1]){const j=i*2+side;accessVertices.setXYZ(j,x+(accessVertices.getX(j)-x)*factor,accessVertices.getY(j),z+(accessVertices.getZ(j)-z)*factor);}
  }
  accessVertices.needsUpdate=true;guestAccess.geometry.computeBoundingSphere();
  guestAccess.userData.navigable=true;group.add(guestAccess);
  // Distant tree masses only: deterministic irregular spacing and height, no playable forest.
  const treeCount=greenery.columns*4;
  const crownParts=[[-.38,.1,0,.67],[.35,.06,.13,.7],[.02,.4,-.23,.68],[0,-.25,.18,.72]].map(([x,y,z,s])=>{
    const geo=new THREE.SphereGeometry(1,12,8),positions=geo.getAttribute('position');
    for(let i=0;i<positions.count;i++){
      const px=positions.getX(i),py=positions.getY(i),pz=positions.getZ(i),r=1+.07*Math.sin(px*15+py*9)*Math.cos(pz*13-py*8);
      positions.setXYZ(i,px*r*s+x,py*r*s+y,pz*r*s+z);
    }
    geo.computeVertexNormals();return geo;
  });
  const crownGeometry=mergeGeometries(crownParts)!;crownParts.forEach(g=>g.dispose());
  const trees = new THREE.InstancedMesh(crownGeometry,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), treeCount);
  trees.name = 'forest-behind-main-campus';
  const instance = new THREE.Object3D();
  // Keep the existing left trees and continue the same spacing behind the Dom lake.
  // This is a visual backdrop proposal, not a claim about surveyed vegetation.
  for (let i = 0; i < treeCount; ++i) {
    const row=Math.floor(i/greenery.columns),col=i%greenery.columns,seed=row*24+col;
    const x = greenery.x-greenery.width/2+18+col*8.5+3.5*Math.sin(seed*1.7)+(row%2)*2.5;
    let z = -48-row*14+5*Math.cos(seed*.61);
    // Keep tree crowns out of the new far-bank guest-house clearing.
    if(x>76&&x<176&&z+draft.frontZ>-204)z=-69-(seed%3)*2;
    const h = 7 + 5 * (0.5 + 0.5 * Math.sin(seed * 2.1));
    instance.position.set(x, h / 2, z);
    instance.scale.set(4.8+(seed%3)*.6,h/2,5.7);
    instance.updateMatrix();
    trees.setMatrixAt(i, instance.matrix);
    trees.setColorAt(i,new THREE.Color(0x355a3c).multiplyScalar(.8+(seed%5)*.1));
  }
  trees.instanceMatrix.needsUpdate = true;
  group.add(trees);
  // Distant skyline ribbons fade down into the sky; no visible terrain plate.
  function skyline(name: string, centerX: number, z: number, width: number, peak: number, color: number, opacity: number) {
    const positions: number[] = [], colors: number[] = [], indices: number[] = [];
    const tint = new THREE.Color(color);
    const n = 30;
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = (u - 0.5) * width;
      const edge = Math.sin(Math.PI * u);
      const silhouette = edge * (0.43 + 0.37 * Math.sin(5.4 * u + 0.7) + 0.12 * Math.sin(22 * u));
      const y = 4 + peak * Math.max(0, silhouette);
      positions.push(x, -18, 0, x, y, 0);
      colors.push(tint.r, tint.g, tint.b, 0, tint.r, tint.g, tint.b, opacity * Math.pow(edge, 0.55));
      if (i < n) { const k = i * 2; indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    geo.setIndex(indices);
    const hill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    }));
    hill.name = name;
    hill.position.set(centerX, 0, z);
    group.add(hill);
  }
  skyline('far-blue-skyline-behind-clubhouse', 65, draft.ridge.offsetZ - 56, 345, 32, 0x9faebc, 0.28);
  skyline('muted-ridge-behind-clubhouse', 93, draft.ridge.offsetZ, 287, 22, 0xa7b7ba, 0.28);
  return group;
}
