import {tr} from '../i18n/index.ts';
import * as THREE from 'three';
import { createSurfaceMaterial } from './surfaceMaterials';
import { roadRibbon, roundedRoad, roundedJunction, ROAD_WIDTH } from './roads';
import type { Collider } from '../types';
import { createRearBackdrop, REAR_SCENERY_BLOCKERS } from './rearBackdrop';
import { createRightDistrict, RIGHT_DISTRICT } from './rightDistrict';
import { createPerimeterFence } from './perimeterFence';
import { createAcademicArchitecture } from './academicArchitecture';
import {createRoadMarkings} from './roadMarkings';
import {createCampusTreeKit} from './campusTrees';
import {pavingOutsideRoads} from './roadBoundary';

// Relative model units only: a modest visual length adjustment along the plaza.
// No measured percentage is inferred; depth, height and centre stay unchanged.
const LECTURE_MASSING_DRAFT = { lengthAlongPlaza: 32, depth: 40, height: 18 };

/** Layout units are relative, not surveyed metres. +Z is the courtyard side. */
/** Low stage under the courtyard flagpoles; `flagDaisHeight` is the walkable floor there. */
// Sits wholly on the pale band between the lecture-front lane (edge z=-27) and the paving (z=-20).
/** Layout units are relative, not surveyed metres. +Z is the courtyard side. */
/** Low stage under the courtyard flagpoles; `flagDaisHeight` is the walkable floor there. */
// Sits wholly on the pale band between the lecture-front lane (edge z=-27) and the paving (z=-20).
export const FLAG_DAIS = { x: 35, z: -23.9, w: 30, d: 5.2, h: .6, stepW: 8, tread: .55 };
export function flagDaisHeight(x: number, z: number) {
  const D = FLAG_DAIS, front = D.z + D.d / 2;
  if (Math.abs(x - D.x) <= D.w / 2 && Math.abs(z - D.z) <= D.d / 2) return D.h;
  if (Math.abs(x - D.x) <= D.stepW / 2 && z > front && z <= front + D.tread * 2) return z <= front + D.tread ? D.h * 2 / 3 : D.h / 3;
  return 0;
}
export function createCampus() {
  const group = new THREE.Group();
  group.name = 'VJU-campus-blockout';
  const colliders: Collider[] = [];
  const mat = (color: number, roughness = 0.9) => new THREE.MeshStandardMaterial({ color, roughness });
  const trim = mat(0xc4ccc8);
  const asphalt = createSurfaceMaterial('asphalt',0xc4cbd1), lawn = createSurfaceMaterial('grass',0xb6cda0);
  const paving = createSurfaceMaterial('pavers',0xe7e3df), pink = createSurfaceMaterial('pavers',0xd9c2af), pole = mat(0xaab7b9, 0.4);
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.castShadow = h > 0.3; mesh.receiveShadow = true;
    group.add(mesh); return mesh;
  };
  // Lake behind Dom and rear forest are scenery, not navigable areas.
  group.add(createRearBackdrop());
  colliders.push(...REAR_SCENERY_BLOCKERS.map(c=>({...c})));
  // Preserve the established left half and plaza footprint; right-side buildings live in rightDistrict.ts.
  box(0, -0.28, -40, 330, 0.5, 344, lawn);
  box(250, -0.28, -40, 170, 0.5, 344, lawn);
  box(380, -0.28, -40, 90, 0.5, 344, lawn);
  // A single rounded apron stops at the front lane, rather than leaving dark
  // rectangular slivers between lecture entrances and their raised forecourt.
  const apron=new THREE.Shape();const ax=-85,bx=86,ay=-57,by=33,ar=8;
  apron.moveTo(ax+ar,ay);apron.lineTo(bx-ar,ay);apron.quadraticCurveTo(bx,ay,bx,ay+ar);
  apron.lineTo(bx,by-ar);apron.quadraticCurveTo(bx,by,bx-ar,by);
  apron.lineTo(ax+ar,by);apron.quadraticCurveTo(ax,by,ax,by-ar);
  apron.lineTo(ax,ay+ar);apron.quadraticCurveTo(ax,ay,ax+ar,ay);apron.closePath();
  const apronMesh=new THREE.Mesh(new THREE.ShapeGeometry(apron,24),asphalt);
  apronMesh.rotation.x=-Math.PI/2;apronMesh.position.y=.055;
  apronMesh.name='continuous-rounded-courtyard-apron';apronMesh.receiveShadow=true;group.add(apronMesh);
  box(0, 0.065, 8, 153, 0.16, 75, trim);
  box(0, 0.17, 8, 144, 0.09, 56, paving).userData.navigationSurface=true;
  // The nearest left corner in 01 is a substantial green plot, not tiled plaza.
  box(-56, 0.235, 23, 30, 0.05, 24, trim);
  box(-56, 0.275, 23, 28, 0.05, 22, lawn);
  box(0, 0.18, 41.5, 144, 0.1, 8, pink);
  // Fine paving grid is one draw call, not hundreds of individual blocks.
  const lines: number[] = [];
  for (let x = -72; x <= 72; x += 3) lines.push(x, 0.225, -20, x, 0.225, 36);
  for (let z = -20; z <= 36; z += 3) lines.push(-72, 0.225, z, 72, 0.225, z);
  const gridGeometry = new THREE.BufferGeometry();
  gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  group.add(new THREE.LineSegments(gridGeometry, new THREE.LineBasicMaterial({ color: 0x92988a, transparent: true, opacity: 0.06 })));
  for (const x of [-60, -36, -12, 12, 36, 60]) {
    box(x, 0.26, 41.5, 18, 0.18, 5, lawn);
  }
  // Road beyond the right edge curves away from the square, as in the aerial.
  const roadPoints = [new THREE.Vector3(-145, 0.05, 82), new THREE.Vector3(-70, 0.05, 77), new THREE.Vector3(35, 0.05, 70), new THREE.Vector3(115, 0.05, 34), new THREE.Vector3(130, 0.05, -40), new THREE.Vector3(128, 0.05, -105), new THREE.Vector3(116, 0.05, -162)];
  const roadCurve = new THREE.CatmullRomCurve3(roadPoints);
  // Retain the exact left centreline up to x=60; extend it with tangent-continuous curves.
  let lo=0, hi=.5;
  for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(roadCurve.getPoint(mid).x<60)lo=mid;else hi=mid;}
  const joinT=(lo+hi)/2, join=roadCurve.getPoint(joinT), tangent=roadCurve.getTangent(joinT);
  const roadSamples=Array.from({length:81},(_,i)=>roadCurve.getPoint(joinT*i/80));
  const approach=new THREE.CubicBezierCurve3(join,join.clone().addScaledVector(tangent,24),new THREE.Vector3(110,0,72),new THREE.Vector3(148,0,72));
  const bend=new THREE.CubicBezierCurve3(new THREE.Vector3(148,0,72),new THREE.Vector3(230,0,72),new THREE.Vector3(308,0,66),new THREE.Vector3(336,0,40));
  const outer=new THREE.CubicBezierCurve3(new THREE.Vector3(336,0,40),new THREE.Vector3(364,0,14),new THREE.Vector3(400,0,0),new THREE.Vector3(418,0,-45));
  const intoForest=new THREE.CubicBezierCurve3(new THREE.Vector3(418,0,-45),new THREE.Vector3(436,0,-90),new THREE.Vector3(436,0,-195),new THREE.Vector3(436,0,-225));
  for(const curve of [approach,bend,outer,intoForest])roadSamples.push(...curve.getSpacedPoints(100).slice(1));
  group.add(roadRibbon('outer-campus-road',roadSamples,ROAD_WIDTH.outer,asphalt));
  const perimeter = createPerimeterFence(roadSamples);
  group.add(perimeter.group);
  colliders.push(...perimeter.colliders);
  group.add(roundedRoad('west-campus-entrance',[[-81,52],[-81,77]],8,asphalt));
  group.add(roundedJunction('junction-west-outer-road',-81,77,
    {north:8,east:ROAD_WIDTH.outer,west:ROAD_WIDTH.outer},asphalt,5));
  // Owner-drawn rear loop: west edge of plaza -> behind both lecture wings -> spine.
  // Keep the road inside the fence and clear of the lake and existing buildings.
  group.add(roundedRoad('lecture-rear-loop',[
    [-81,52],[-81,-42],[-88,-52],[-88,-88],[84,-88],
  ],ROAD_WIDTH.branch,asphalt,5));
  group.add(roundedJunction('junction-lecture-rear-spine',84,-88,
    {north:ROAD_WIDTH.spine,south:ROAD_WIDTH.spine,west:ROAD_WIDTH.branch},asphalt,3));
  group.add(roundedRoad('continuous-lecture-front-lane',[[-81,-30],[84,-30]],ROAD_WIDTH.branch,asphalt));
  group.add(roundedJunction('junction-west-lecture-front',-81,-30,
    {north:6,south:6,east:ROAD_WIDTH.branch},asphalt,4));
  // The gate and east campus connector are built by the right district module.

  // Owner-approved scope: redistribute only HQ / auditorium width, 38 + 2 + 38.
  // All other buildings, roads and collision envelopes remain unchanged.
  group.add(createAcademicArchitecture());
  for(const [x,name] of [[-62,tr('GIẢNG ĐƯỜNG 2')],[-27,tr('GIẢNG ĐƯỜNG 1')]] as const) {
    const w=LECTURE_MASSING_DRAFT.lengthAlongPlaza,d=LECTURE_MASSING_DRAFT.depth;
    colliders.push({minX:x-w/2,maxX:x+w/2,minZ:-59-d/2,maxZ:-59+d/2,label:name});
    colliders.push({minX:x+5,maxX:x+11,minZ:-39,maxZ:-33.9,label:tr('{0} — tháp thang',{0:name})});
  }
  colliders.push({minX:-1,maxX:37,minZ:-58,maxZ:-36.55,label:tr('Nhà Hiệu bộ')});
  colliders.push({minX:10.5,maxX:25.5,minZ:-54.5,maxZ:-43.5,label:tr('Mái Nhà Hiệu bộ')});
  colliders.push({minX:39,maxX:77,minZ:-68,maxZ:-40,label:tr('Hội trường')});
  colliders.push({minX:11.7,maxX:24.3,minZ:-39.35,maxZ:-34.25,label:tr('Sảnh Nhà Hiệu bộ')});
  // Keep paving on the building side, clear of the continuous asphalt lane.
  // Clip the GD2 corner to the same rounded asphalt boundary used by the paint.
  for(const rings of pavingOutsideRoads([[[-79,-37.5],[79,-37.5],[79,-33],[-79,-33],[-79,-37.5]]],group)){
    const shape=new THREE.Shape(rings[0].map(([x,z])=>new THREE.Vector2(x,-z)));
    rings.slice(1).forEach(r=>shape.holes.push(new THREE.Path(r.map(([x,z])=>new THREE.Vector2(x,-z)))));
    const surface=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.16,bevelEnabled:false,steps:1}),paving);
    surface.rotation.x=-Math.PI/2;surface.position.y=.01;surface.name='lecture-front-paving';surface.receiveShadow=true;group.add(surface);
  }

  // The corrected right district is independent of the left blockout.
  const rightDistrict = createRightDistrict();
  group.add(rightDistrict.group);
  colliders.push(...rightDistrict.colliders);

  // Sparse, staggered planting frames the architecture instead of screening it.
  // Keep the HQ entrance (x18), auditorium (x58), and stage (-34) axes open.
  const createTree=createCampusTreeKit();
  const tree = (x: number, z: number) => {
    group.add(...createTree(x,z));
    colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3, label: tr('Cây') });
  };
  for(const [x,z] of [[-74,-24.5],[-49,-25],[-8,-24],[76,-24.5]])tree(x,z);
  for(const [x,z] of [[-63,41.5],[-38,42],[-12,41],[15,42],[42,41.5],[65,42]])tree(x,z);
  for(const z of [4,26])tree(79,z);
  // Two representative national flags remain at the HQ; the five poles match the visible cluster.
  const flagMaterial = (japan: boolean) => {
    const c = document.createElement('canvas'); c.width = 192; c.height = 128;
    const ctx = c.getContext('2d')!; ctx.fillStyle = japan ? '#fffdf6' : '#d82732'; ctx.fillRect(0, 0, 192, 128);
    if (japan) { ctx.fillStyle = '#c52436'; ctx.beginPath(); ctx.arc(96, 64, 32, 0, Math.PI * 2); ctx.fill(); }
    else {
      ctx.fillStyle = '#ffe05a'; ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 13 : 33; ctx.lineTo(96 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 1 });
  };
  const vn = flagMaterial(false), jp = flagMaterial(true);
  // Flag dais: a low stage under the five poles, climbed by the front steps only.
  // Proposed proportions, not surveyed. Thin edge colliders keep the height change at the steps.
  const D = FLAG_DAIS, daisTop = D.h + .17;
  box(D.x, daisTop / 2 + .08, D.z, D.w, daisTop - .16, D.d, trim).name = 'flag-dais-body';
  box(D.x, daisTop + .03, D.z, D.w + .3, .1, D.d + .3, paving).name = 'flag-dais-deck';
  for (let s = 0; s < 2; s++) box(D.x, .17 + (s + 1) * D.h / 3 / 2, D.z + D.d / 2 + D.tread * (1.5 - s), D.stepW, (s + 1) * D.h / 3, D.tread, trim).name = 'flag-dais-step';
  const edge = (minX: number, maxX: number, minZ: number, maxZ: number) => colliders.push({ minX, maxX, minZ, maxZ, maxY: 1, label: tr('Mép bục cờ') });
  const front = D.z + D.d / 2, back = D.z - D.d / 2, left = D.x - D.w / 2, right = D.x + D.w / 2, stepL = D.x - D.stepW / 2, stepR = D.x + D.stepW / 2;
  edge(left, right, back, back + .5); edge(left, left + .5, back, front); edge(right - .5, right, back, front);
  edge(left, stepL, front - .5, front); edge(stepR, right, front - .5, front);
  edge(stepL - .5, stepL, front, front + D.tread * 2); edge(stepR, stepR + .5, front, front + D.tread * 2);
  for (let i = 0; i < 5; i++) {
    const x = 23 + i * 6;
    box(x, 6.3, D.z, 0.13, 12.6, 0.13, pole);
    box(x, daisTop + 0.3, D.z, 1, 0.5, 1, trim);
    colliders.push({ minX: x - 0.5, maxX: x + 0.5, minZ: D.z - .5, maxZ: D.z + .5, label: tr('Chân cột cờ') });
    if (i === 1 || i === 3) {
      // Hoist edge sits on the pole (local +x after the half turn); segments let the cloth wave in the breeze shader.
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(3, 2, 24, 8), i === 1 ? vn : jp);
      flag.position.set(x + 1.5, 11.35, D.z);flag.name = i === 1 ? 'courtyard-vietnam-flag' : 'courtyard-japan-flag'; flag.rotation.y = Math.PI; group.add(flag);
    }
  }
  group.add(createRoadMarkings(group));
  // Relative gate position from the user-marked flycam, not a surveyed coordinate.
  const gate = new THREE.Vector3(RIGHT_DISTRICT.gate.x, 0, RIGHT_DISTRICT.gate.z);
  return {
    group, colliders, heightAt: flagDaisHeight,
    landmarks: { gate, spawn: gate.clone(), plaza: new THREE.Vector3(0, 0, 8), flagpoles: new THREE.Vector3(FLAG_DAIS.x, 0, FLAG_DAIS.z), headquarters: new THREE.Vector3(18, 0, -48) },
    views: {
      flycam: { position: new THREE.Vector3(-170, 120, 170), target: new THREE.Vector3(4, 0, -12) },
      courtyard: { position: new THREE.Vector3(58, 1.7, 36), target: new THREE.Vector3(0, 8, -39) },
    },
    bounds: { minX: -102, maxX: RIGHT_DISTRICT.bounds.maxX, minZ: RIGHT_DISTRICT.bounds.minZ, maxZ: 78 },
  };
}
