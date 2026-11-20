import {tr} from '../i18n/index.ts';
import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import type {Polygon} from 'polygon-clipping';
import {FOOTBALL} from './footballLayout';
import {createJapaneseClubHouse} from './hospitalityBuildings';
import { createSurfaceMaterial } from './surfaceMaterials';
import { roundedRoad, roundedJunction, ROAD_WIDTH } from './roads';
import { createDomBlock } from './domBlock';
import { createGateFlags } from './gateFlags';
import { createCampusGardens } from './campusGardens';
import { detailBatch, districtPlaster } from './districtFinishes';
import {labEntrance,sportsEntrances} from './campusEntrances';
import {createCanteenLibrary} from './canteenLibrary';
import type { Collider } from '../types';

// Owner-labelled satellite image, 2026-11-15. Model units remain approximate.
export const RIGHT_DISTRICT = {
  gate: { x: 84, z: 52 },
  junction: { x: 84, z: -30 },
  labs: { x: 115, z: -69 },
  canteenLibrary: { x: 170, z: -60 },
  rearRoad: { x: 120, z: -88 },
  club: { x: 170, z: -111 },
  football: { x: 167, z: 8 },
  rearApproach: { x: 84, z: -133 },
  bounds: { maxX: 308, minZ: -196 },
} as const;

// Eight physical blocks: SEVEN Dom + faculty office at T1. +Z is image bottom.
// IDs are review IDs, not official building numbers. Offsets/lengths are visual estimates.
export const DOM_LAYOUT_DRAFT = [
  {id:'N1',displayName:'DOM-A',kind:'dom',zone:'outer',x:220,z:1,length:32,depth:9,rotation:-Math.PI/2,towerSide:1},
  {id:'N2',displayName:'DOM-B',kind:'dom',zone:'outer',x:244,z:3,length:34,depth:9,rotation:-Math.PI/2,towerSide:1},
  {id:'N3',displayName:'DOM-C',kind:'dom',zone:'outer',x:268,z:6,length:34,depth:9,rotation:-Math.PI/2,towerSide:1},
  {id:'N4',displayName:'DOM-D',kind:'dom',zone:'outer',x:292,z:7,length:32,depth:9,rotation:-Math.PI/2,towerSide:1},
  {id:'T1',displayName:'VP KHOA',kind:'office',zone:'inner-parallel',x:220,z:-50,length:34,depth:9,rotation:-Math.PI/2,towerSide:-1},
  {id:'T2',displayName:'DOM-E',kind:'dom',zone:'inner-parallel',x:244,z:-48,length:35,depth:9,rotation:-Math.PI/2,towerSide:-1},
  {id:'T3',displayName:'DOM-F',kind:'dom',zone:'inner-joined',x:270,z:-51,length:30,depth:9,rotation:0,towerSide:-1},
  {id:'T4',displayName:'DOM-G',kind:'dom',zone:'inner-joined',x:294,z:-44,length:28,depth:9,rotation:0,towerSide:1},
] as const;

export function createRightDistrict() {
  const group = new THREE.Group();
  group.name = 'right-campus-expansion-approximate';
  const colliders: Collider[] = [];
  const white = districtPlaster(0xe1e6e2);
  const roof = new THREE.MeshStandardMaterial({ color: 0x507b76, roughness: 0.85 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x5c8790, roughness: 0.55 });glass.name='campus-window-glass';
  const terra = new THREE.MeshStandardMaterial({ color: 0x9a7270, roughness: 0.95 });
  const asphalt = createSurfaceMaterial('asphalt',0xc4cbd1);
  const curb = new THREE.MeshStandardMaterial({ color: 0xb8b5a8, roughness: 0.95 });
  const grass = createSurfaceMaterial('grass',0xb6cda0);
  function box(x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  function collider(x: number, z: number, w: number, d: number, label: string) {
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, label });
  }
  function building(x: number, z: number, w: number, d: number, h: number, label: string, isHall = false) {
    const plaster=districtPlaster(0xe4e2d7), clay=districtPlaster(0x995f4b);
    const recess=new THREE.MeshStandardMaterial({color:0x34494b,roughness:.74});
    const aluminium=new THREE.MeshStandardMaterial({color:0x929d9c,roughness:.39,metalness:.5});
    const darkGlass=new THREE.MeshStandardMaterial({color:0x3c6268,roughness:.24,metalness:.22});
    box(x, h / 2, z, w, h, d, plaster).name = label;
    // Shallow metal roof and white fascia from the actual entrance view, not the festival concept.
    const ridge=h+.65,eave=h+.12,half=w/2+.65;
    for(const side of [-1,1]){
      const panel=box(x+side*half/2,(ridge+eave)/2,z,Math.hypot(half,ridge-eave),.16,d+1.2,aluminium);
      panel.rotation.z=-side*Math.atan2(ridge-eave,half);panel.name='multipurpose-shallow-metal-roof';
    }
    box(x,h-.12,z+d/2+.14,w+.6,.95,.36,plaster).name='multipurpose-white-fascia';
    collider(x, z, w, d, label);
    const columns = isHall ? 5 : 8;
    const floors = isHall ? 1 : 3;
    const spacing = (w - 2.5) / columns;
    const details=detailBatch('multipurpose-photo-facade-details');
    for (let i = 0; i < columns; i++) {
      const col = x - (columns - 1) * spacing / 2 + i * spacing;
      for (let f = 0; f < floors; f++) {
        details.add(clay,col,2.7,z+d/2+.06,spacing-.55,4.8,.12);
        details.add(recess,col,h-1.55,z+d/2+.08,spacing-.55,1.45,.14);
        for(let l=0;l<7;l++)details.add(aluminium,col,h-2.14+l*.19,z+d/2+.18,spacing-.62,.055,.12);
        for(const offset of [-.65,.65]){
          details.add(plaster,col+offset,2.7,z+d/2+.18,.6,2.3,.18);
          details.add(darkGlass,col+offset,2.7,z+d/2+.285,.44,2.1,.035);
        }
      }
      if (isHall) details.add(plaster,col+spacing/2,h/2,z+d/2+.23,.56,h,.46);
    }
    // Road-facing long elevation has the same structure, fewer inferred openings.
    for(let i=0;i<8;i++){
      const bz=z-d/2+3.3+i*(d-6.6)/7;
      details.add(clay,x-w/2-.055,2.7,bz,.11,4.8,5.3);
      details.add(recess,x-w/2-.07,h-1.55,bz,.14,1.45,5.3);
      for(let l=0;l<7;l++)details.add(aluminium,x-w/2-.18,h-2.14+l*.19,bz,.12,.055,5.2);
      details.add(plaster,x-w/2-.23,h/2,bz+2.85,.46,h,.5);
    }
    details.add(plaster,x-w/2-.15,h-.12,z,.3,.95,d+.6);
    details.add(plaster,x,.25,z+d/2+.08,w,.5,.16);
    group.add(details.finish());
  }

  const campusBlue = new THREE.MeshStandardMaterial({ color: 0x327b92, roughness: 0.88 });
  const ochre = new THREE.MeshStandardMaterial({ color: 0xab7a5d, roughness: 0.9 });
  function campusBlock(x: number, z: number, w: number, d: number, h: number, label: string, floors: number, kind: 'dom' | 'lab' | 'canteen' | 'club') {
    const body = box(x, h / 2, z, w, h, d, kind === 'club' ? terra : white);
    body.name = label;
    body.userData = { floors, kind, frontVector: kind === 'club' ? [0,0,-1] : [0,0,1], provisionalDimensions:true };
    if(kind==='club'){
      const orange=new THREE.MeshStandardMaterial({color:0xc2774d,roughness:.9});
      box(x,h+.12,z,w+1.2,.24,d+1.2,orange).name='clubhouse-orange-eaves';
      const hipGeometry=new THREE.ConeGeometry(1,1,4);hipGeometry.rotateY(Math.PI/4);
      const hip=new THREE.Mesh(hipGeometry,orange);hip.scale.set((w+1.2)/Math.SQRT2,3,(d+1.2)/Math.SQRT2);hip.position.set(x,h+1.65,z);hip.name='clubhouse-orange-hip-roof';group.add(hip);
    }else box(x, h + 0.3, z, w + 0.9, 0.6, d + 0.9, roof);
    collider(x, z, w, d, label);
    const facing = kind === 'club' ? -1 : 1;
    const facadeZ = z + facing * (d / 2 + 0.065);
    const frontage = w;
    const n = Math.min(10, Math.max(3, Math.round(frontage / 3)));
    const spacing = (frontage - 2.2) / n;
    for (let col = 0; col < n; col++) {
      for (let f = 0; f < floors; f++) {
        if(kind==='lab'&&f===0&&(col===2||col===4||col===5))continue;
        const offset = (col - (n - 1) / 2) * spacing;
        box(x + offset, (f + 0.6) * h / floors, facadeZ, spacing * 0.7, Math.min(1.65, h / floors * 0.52), 0.13, glass);
      }
    }
    if (kind === 'dom') {
      const stripX = x + w / 2 - 1.15;
      box(stripX, h / 2, facadeZ + 0.12, 1.1, h, 0.24, campusBlue);
      box(stripX - 0.85, h + 0.75, z, 3.6, 1.5, d * 0.42, ochre);
    }
    if (kind === 'canteen') {
      box(x - w * 0.32, h * 0.5, facadeZ + 0.09, 1.5, h, 0.2, campusBlue);
      const details=detailBatch('rmit-two-storey-facade-details');
      const plaster=districtPlaster(0xe6e6dc);
      const frame=new THREE.MeshStandardMaterial({color:0xc0c9c8,roughness:.4,metalness:.45});
      const recessed=new THREE.MeshStandardMaterial({color:0x354e54,roughness:.29,metalness:.15});
      const screen=districtPlaster(0xa7765f);
      // White structural grid, glazed lower frontage and vertical clay screen visible in the flycam.
      for(let col=0;col<n;col++){
        const bx=x+(col-(n-1)/2)*spacing;
        for(let f=0;f<floors;f++){
          const by=(f+.6)*h/floors,openingH=Math.min(1.65,h/floors*.52),openingW=spacing*.7;
          details.add(recessed,bx,by,facadeZ+.075,openingW+.14,openingH+.14,.055);
          for(const side of [-1,1])details.add(frame,bx+side*openingW/2,by,facadeZ+.13,.07,openingH,.08);
          details.add(frame,bx,by,facadeZ+.13,.06,openingH,.08);
          details.add(plaster,bx,by-openingH/2-.1,facadeZ+.16,openingW+.35,.14,.26);
        }
        details.add(plaster,bx-spacing/2,h/2,facadeZ+.15,.32,h,.3);
      }
      for(const by of [.25,h/2,h-.05])details.add(plaster,x,by,facadeZ+.18,w,.25,.36);
      const screenX=x-w*.12;
      details.add(screen,screenX,h/2,facadeZ+.22,4.8,h-.4,.32);
      for(let i=0;i<15;i++)details.add(plaster,screenX-2.25+i*.32,h/2,facadeZ+.42,.07,h-.6,.11);
      // Roof is still the approved solid block: describe the observed pale/green roof strips only.
      for(let i=0;i<5;i++)details.add(plaster,x-w/2+7+i*(w-14)/4,h+.64,z,.22,.08,d-.3);
      group.add(details.finish());
    }
  }

  // One connected hierarchy: main spine, branches, narrower residential access.
  const road=(name:string,points:readonly (readonly [number,number])[],width:number)=>group.add(roundedRoad(name,points,width,asphalt));
  road('gate-to-rear-spine',[[84,65],[84,-133]],ROAD_WIDTH.spine);
  road('hieu-bo-left-branch',[[84,-30],[53,-30]],ROAD_WIDTH.branch);
  // Shared south approach removes the short parallel jog beside the football field.
  road('field-south-access',[[84,43],[207,43]],ROAD_WIDTH.branch);
  road('field-north-to-dom',[[84,-25],[294,-25]],ROAD_WIDTH.branch);
  road('field-to-dom-connector',[[207,43],[279,43],[279,-25]],ROAD_WIDTH.access);
  road('dom-n1-to-secondary-gate',[[207,43],[207,72]],ROAD_WIDTH.branch);
  // Satellite distinguishes the roofed west half from the open pitch to its east.
  building(112,8,40,52,11.5,tr('Nhà đa năng'),true);
  group.add(sportsEntrances(112,8,40,52,11.5));
  // Owner: larger landscape pitch; remove the old lane through its east half.
  // Owner 15/11: stadium-style mown turf, taller netted goals and a centre ball. Visual only; no colliders added.
  const turfCanvas=document.createElement('canvas');turfCanvas.width=1024;turfCanvas.height=512;const turf=turfCanvas.getContext('2d')!;
  for(let i=0;i<14;i++){turf.fillStyle=i%2?'#4f7a3b':'#5d8b45';turf.fillRect(Math.floor(i*1024/14),0,Math.ceil(1024/14),512);}
  let turfSeed=1120;const turfRandom=()=>{turfSeed=(turfSeed*1664525+1013904223)>>>0;return turfSeed/4294967296;};
  for(let i=0;i<70000;i++){turf.fillStyle=i%2?'rgba(24,52,20,.06)':'rgba(170,200,130,.06)';turf.fillRect(turfRandom()*1024,turfRandom()*512,1,1+turfRandom()*2);}
  const turfTexture=new THREE.CanvasTexture(turfCanvas);turfTexture.colorSpace=THREE.SRGBColorSpace;turfTexture.anisotropy=8;
  const turfMaterial=new THREE.MeshStandardMaterial({map:turfTexture,roughness:.96});turfMaterial.name='football-mown-turf';
  box(167, 0.08, 8, 62, 0.1, 40, turfMaterial).name = 'football-field';
  const field = new THREE.LineBasicMaterial({ color: 0xf4f1e6 });
  const pitchLines = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(138, .16, -10), new THREE.Vector3(196, .16, -10),
    new THREE.Vector3(196, .16, 26), new THREE.Vector3(138, .16, 26),
    new THREE.Vector3(138, .16, -10),
  ]);
  group.add(new THREE.Line(pitchLines, field));
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(167,.16,-10),new THREE.Vector3(167,.16,26),
  ]),field));
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
    Array.from({length:65},(_,i)=>new THREE.Vector3(167+4*Math.cos(i*Math.PI/32),.16,8+4*Math.sin(i*Math.PI/32))),
  ),field));
  const netCanvas=document.createElement('canvas');netCanvas.width=netCanvas.height=64;const netCtx=netCanvas.getContext('2d')!;
  netCtx.strokeStyle='rgba(255,255,255,.92)';netCtx.lineWidth=5;netCtx.strokeRect(0,0,64,64);
  const netTexture=new THREE.CanvasTexture(netCanvas);netTexture.wrapS=netTexture.wrapT=THREE.RepeatWrapping;netTexture.colorSpace=THREE.SRGBColorSpace;netTexture.anisotropy=8;
  const netMaterial=new THREE.MeshBasicMaterial({map:netTexture,transparent:true,side:THREE.DoubleSide,depthWrite:false});netMaterial.name='football-goal-net';
  // One net cell is .4 model units regardless of panel size.
  const netPanel=(w:number,h:number)=>{
    const geometry=new THREE.PlaneGeometry(w,h),uv=geometry.getAttribute('uv');
    for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w/.4,uv.getY(i)*h/.4);
    const mesh=new THREE.Mesh(geometry,netMaterial);mesh.name='football-goal-net';group.add(mesh);return mesh;
  };
  const GOAL=FOOTBALL.goal;
  for (const x of FOOTBALL.goalXs) {
    const out=x<167?-1:1,back=x+out*GOAL.depth,mid=x+out*GOAL.depth/2;
    for (const z of [8-GOAL.width/2, 8+GOAL.width/2]) {
      box(x, GOAL.height/2, z, GOAL.post, GOAL.height, GOAL.post, white);
      box(back, GOAL.height/2, z, .08, GOAL.height, .08, white);
      box(mid, GOAL.height, z, GOAL.depth, .08, .08, white);
      netPanel(GOAL.depth,GOAL.height).position.set(mid,GOAL.height/2,z);
    }
    box(x, GOAL.height, 8, GOAL.post, GOAL.post, GOAL.width+GOAL.post, white);
    box(back, GOAL.height, 8, .08, .08, GOAL.width, white);
    const rear=netPanel(GOAL.width,GOAL.height);rear.rotation.y=Math.PI/2;rear.position.set(back,GOAL.height/2,8);
    const top=netPanel(GOAL.depth,GOAL.width);top.rotation.x=-Math.PI/2;top.position.set(mid,GOAL.height,8);
    // Penalty area in front of each goal.
    const inward=-out;
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x,.16,-2),new THREE.Vector3(x+inward*9,.16,-2),new THREE.Vector3(x+inward*9,.16,18),new THREE.Vector3(x,.16,18),
    ]),field));
  }
  const ballCanvas=document.createElement('canvas');ballCanvas.width=256;ballCanvas.height=128;const ballCtx=ballCanvas.getContext('2d')!;
  ballCtx.fillStyle='#f5f4ee';ballCtx.fillRect(0,0,256,128);ballCtx.fillStyle='#22262b';
  for(let i=0;i<12;i++){ballCtx.beginPath();ballCtx.ellipse(21+(i%6)*42.7+(i<6?0:21),i<6?40:88,11,12,0,0,Math.PI*2);ballCtx.fill();}
  const ballTexture=new THREE.CanvasTexture(ballCanvas);ballTexture.colorSpace=THREE.SRGBColorSpace;
  const ball=new THREE.Mesh(new THREE.SphereGeometry(FOOTBALL.radius,24,16),new THREE.MeshStandardMaterial({map:ballTexture,roughness:.55}));
  ball.name='football-centre-ball';ball.position.set(FOOTBALL.x,FOOTBALL.ground+FOOTBALL.radius,FOOTBALL.z);ball.castShadow=true;group.add(ball);
  const domPaving:Polygon[]=[];
  const pave=(x1:number,z1:number,x2:number,z2:number)=>domPaving.push([[[x1,z1],[x2,z1],[x2,z2],[x1,z2],[x1,z1]]]);
  for(const spec of DOM_LAYOUT_DRAFT){
    const {id,displayName,kind,zone,x,z,length,depth,rotation,towerSide}=spec;
    const {group:dom,footprint}=createDomBlock(length,depth,towerSide,displayName,kind==='office'?1:towerSide);
    dom.rotation.y=rotation;dom.position.set(x,0,z);dom.name=kind==='office'?tr('Văn phòng Khoa'):`Dom review ${id}`;
    const front=new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),rotation);
    dom.userData={...dom.userData,id,kind,zone,frontVector:front.toArray(),provisionalDimensions:true};group.add(dom);
    const corners=[new THREE.Vector3(footprint.minX,0,footprint.minZ),new THREE.Vector3(footprint.maxX,0,footprint.maxZ),new THREE.Vector3(footprint.minX,0,footprint.maxZ),new THREE.Vector3(footprint.maxX,0,footprint.minZ)]
      .map(p=>p.applyAxisAngle(new THREE.Vector3(0,1,0),rotation).add(dom.position));
    const bounds=new THREE.Box3().setFromPoints(corners);
    colliders.push({minX:bounds.min.x,maxX:bounds.max.x,minZ:bounds.min.z,maxZ:bounds.max.z,label:kind==='office'?tr('Văn phòng Khoa'):`Dom ${id}`});
    if(zone==='inner-joined'){
      pave(x-length/2,z+depth/2+1,x+length/2,z+depth/2+9);
    }else{
      const laneWidth=x===220?ROAD_WIDTH.branch:ROAD_WIDTH.access;
      // Stop at the actual near edge of the parallel lane; no slab across asphalt.
      pave(x-13+laneWidth/2+.12,z-length/2+1,x-depth/2-.1,z+length/2-1);
    }
    const arrowStart=new THREE.Vector3(x,.4,z).addScaledVector(front,7);
    const arrow=new THREE.ArrowHelper(front,arrowStart,7,0x334d60,2,1.5);arrow.name='dom-review-direction';arrow.visible=false;group.add(arrow);
  }
  // Return around the upper-left pair instead of leaving a blind road above T2.
  road('dom-upper-court-return',[[207,-78],[231,-78],[231,43]],ROAD_WIDTH.access);
  road('dom-column-access-3',[[255,43],[255,-25]],ROAD_WIDTH.access);
  // Stop at the T4 footpath; trim the unused tail past its entrance.
  // The continuous field-north-to-dom lane also serves the space between rows.
  // Paths meet the two offset horizontal wings from the shared inner court.
  for(const b of DOM_LAYOUT_DRAFT.filter(b=>b.zone==='inner-joined')){
    const front=b.z+b.depth/2;pave(b.x-1.6,front,b.x+1.6,-25-ROAD_WIDTH.branch/2-.12);
  }
  // Merge adjoining forecourts and links so coplanar faces cannot flicker.
  const paving=new THREE.Group();paving.name='dom-paving-unified';
  for(const rings of polygonClipping.union(domPaving[0],...domPaving.slice(1))){
    const shape=new THREE.Shape(rings[0].map(([x,z])=>new THREE.Vector2(x,-z)));
    rings.slice(1).forEach(r=>shape.holes.push(new THREE.Path(r.map(([x,z])=>new THREE.Vector2(x,-z)))));
    const surface=new THREE.Mesh(new THREE.ShapeGeometry(shape),curb);surface.rotation.x=-Math.PI/2;surface.position.y=.14;surface.receiveShadow=true;paving.add(surface);
  }
  group.add(paving);

  campusBlock(115, -69, 38, 14, 6.6, tr('Khu Thí nghiệm'), 2, 'lab');
  group.add(labEntrance(115,-69,38,6.6));
  box(115,.12,-48,38,.14,22,grass).name='lab-front-garden';
  road('cross-road-between-lab-and-club',[[84,-88],[207,-88],[207,43]],ROAD_WIDTH.branch);
  // Small road-edge fillets soften T/cross junctions without moving building plots.
  const junction=(name:string,x:number,z:number,arms:Parameters<typeof roundedJunction>[3],radius=2.5)=>
    group.add(roundedJunction(name,x,z,arms,asphalt,radius));
  junction('junction-field-entry',84,43,{north:8,south:8.94,east:6},3); // south arm: flared gate spine is 8.94 wide at z=46
  junction('junction-hq-field',84,-30,{north:8,south:8,west:6},3);
  junction('junction-field-north',84,-25,{north:8,south:8,east:6},3);
  junction('junction-rear-road',84,-88,{north:8,south:8,east:6},3);
  junction('junction-dom-west-south',207,43,{north:6,south:6,west:6,east:5},3);
  junction('junction-secondary-outer-road',207,71,{north:6,east:12,west:12},4);
  junction('junction-dom-return',207,-78,{north:6,south:6,east:5},2);
  junction('junction-dom-west-court',207,-25,{north:6,south:6,east:6,west:6});
  junction('junction-dom-inner-court',231,-25,{north:5,south:5,east:6,west:6});
  for(const x of [231,255])junction(`junction-dom-south-${x}`,x,43,{north:5,east:5,west:5});
  for(const x of [255,279])junction(`junction-dom-court-${x}`,x,-25,{south:5,east:6,west:6});
  const club=createJapaneseClubHouse();group.add(club.group);colliders.push(...club.colliders);
  box(170,.12,-121,28,.15,4,curb).name='club-lake-facing-terrace';
  road('clubhouse-access',[[170,-88],[170,-100]],ROAD_WIDTH.access);
  junction('junction-clubhouse',170,-88,{east:6,west:6,north:5},2);
  const canteen=createCanteenLibrary();group.add(canteen.group);colliders.push(...canteen.colliders);
  const gardens=createCampusGardens();group.add(gardens.group);colliders.push(...gardens.colliders);
  // Eight component blocks follow the latest owner description; dimensions remain provisional.
  // Source: red-circled aerial 07 plus the two close photos of signage/guardhouse.
  // Leave an open lane; buildings, sign and walls have collision, not the opening.
  const g = RIGHT_DISTRICT.gate;
  // Owner correction: stone stele and guard room are BOTH left when entering (-X).
  // Keep the entrance straight on x=84; sizes below remain review estimates.
  // Owner correction: tuck the room against the outer courtyard corner beside the gate.
  // Body stays inside the east curb x=76.5 and clear of the front lane edge z=40.
  const guardX=g.x-12.5, guardZ=g.z-16;
  const cream=districtPlaster(0xeee6ce);
  const gateTerra=districtPlaster(0xb99c80);
  const guardWall=districtPlaster(0xf0efe7);
  const gateMetal=new THREE.MeshStandardMaterial({color:0xc2cacb,roughness:.42,metalness:.55});
  const guardRoof=new THREE.MeshStandardMaterial({color:0x397e88,roughness:.48,metalness:.4,side:THREE.DoubleSide});
  box(guardX,1.75,guardZ,8.8,3.5,7.4,guardWall).name=tr('Nhà trực cổng VJU — khối thô');
  collider(guardX,guardZ,8.8,7.4,tr('Nhà trực cổng VJU — khối thô'));
  box(guardX,3.62,guardZ,9.7,.32,8.3,guardWall).name='guardhouse-cream-fascia';
  // Four hip slopes and metal seams from the real guardhouse photo, not the concept.
  const roofY=3.8,ridgeY=5.55,rx=4.85,rz=4.15,ridge=.7;
  const roofVertices:number[]=[];
  const a=[-rx,roofY,-rz],b=[rx,roofY,-rz],roofC=[rx,roofY,rz],d=[-rx,roofY,rz],e=[-ridge,ridgeY,0],f=[ridge,ridgeY,0];
  for(const triangle of [[a,e,f],[a,f,b],[d,roofC,f],[d,f,e],[a,d,e],[b,f,roofC]])for(const p of triangle)roofVertices.push(...p);
  const hipGeometry=new THREE.BufferGeometry();hipGeometry.setAttribute('position',new THREE.Float32BufferAttribute(roofVertices,3));hipGeometry.computeVertexNormals();
  const hip=new THREE.Mesh(hipGeometry,guardRoof);hip.position.set(guardX,0,guardZ);hip.name='guardhouse-green-hip-roof';hip.userData.slopes=4;group.add(hip);
  const seams:THREE.Vector3[]=[];
  for(const side of [-1,1]){
    for(let x=-rx+.12;x<rx;x+=.24){const t=Math.min(1,(rx-Math.abs(x))/(rx-ridge));seams.push(new THREE.Vector3(x,roofY+.025,side*rz),new THREE.Vector3(x,roofY+(ridgeY-roofY)*t+.025,side*rz*(1-t)));}
    for(let z=-rz+.12;z<rz;z+=.24){const t=1-Math.abs(z)/rz;seams.push(new THREE.Vector3(side*rx,roofY+.025,z),new THREE.Vector3(side*(rx-(rx-ridge)*t),roofY+(ridgeY-roofY)*t+.025,z));}
  }
  const seamLines=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seams),new THREE.LineBasicMaterial({color:0x78a3a8}));seamLines.position.set(guardX,0,guardZ);seamLines.name='guardhouse-metal-roof-seams';group.add(seamLines);
  for(const offset of [-2.8,0,2.8]){box(guardX+offset,1.85,guardZ+3.75,2.08,1.98,.12,white);box(guardX+offset,1.85,guardZ+3.83,1.84,1.74,.1,glass);box(guardX+offset,1.85,guardZ+3.9,.055,1.74,.05,gateMetal);}
  for(const offset of [-2,1.5]){box(guardX+4.45,1.85,guardZ+offset,.12,1.98,2.48,white);box(guardX+4.53,1.85,guardZ+offset,.1,1.74,2.24,glass);}
  const stoneX=g.x-18,stoneZ=g.z+6;
  // Photo proportions, contained within the same approved sign plot/collision boundary.
  const signW=6.8,signH=4.4,signY=.3+signH/2;
  const stoneCanvas=document.createElement('canvas');stoneCanvas.width=2040;stoneCanvas.height=1320;
  const sc=stoneCanvas.getContext('2d')!;sc.fillStyle='#181e21';sc.fillRect(0,0,2040,1320);
  let seed=1837;const noise=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  for(let row=0;row<5;row++)for(let col=0;col<4;col++){const grey=21+Math.floor(noise()*6);sc.fillStyle=`rgb(${grey},${grey+5},${grey+7})`;sc.fillRect(col*510+1,row*264+1,508,262);}
  for(let i=0;i<45000;i++){const value=noise()>.5?'rgba(190,205,210,.055)':'rgba(0,4,7,.08)';sc.fillStyle=value;sc.fillRect(noise()*2040,noise()*1320,1+noise()*3,1+noise()*2);}
  sc.strokeStyle='rgba(119,133,135,.38)';sc.lineWidth=2;
  for(let x=510;x<2040;x+=510){sc.beginPath();sc.moveTo(x,0);sc.lineTo(x,1320);sc.stroke();}
  for(let y=264;y<1320;y+=264){sc.beginPath();sc.moveTo(0,y);sc.lineTo(2040,y);sc.stroke();}
  const stoneMap=new THREE.CanvasTexture(stoneCanvas);stoneMap.colorSpace=THREE.SRGBColorSpace;stoneMap.anisotropy=8;
  // Local reflection proxy only for polished stone; no photo is pasted on the surface.
  const envFaces=Array.from({length:6},()=>{const c=document.createElement('canvas');c.width=c.height=128;const cx=c.getContext('2d')!;const grad=cx.createLinearGradient(0,0,0,128);grad.addColorStop(0,'#b2c9dc');grad.addColorStop(.5,'#b7c4c9');grad.addColorStop(.57,'#496051');grad.addColorStop(1,'#27322e');cx.fillStyle=grad;cx.fillRect(0,0,128,128);return c;});
  // WebGL accepts canvas TexImageSources; CubeTexture's type declarations are narrower.
  const env=new THREE.CubeTexture(envFaces as unknown as HTMLImageElement[]);env.colorSpace=THREE.SRGBColorSpace;env.needsUpdate=true;
  const signBase=new THREE.MeshPhysicalMaterial({map:stoneMap,color:0xffffff,roughness:.32,metalness:.08,clearcoat:.3,clearcoatRoughness:.28,envMap:env,envMapIntensity:.3});
  box(stoneX,.18,stoneZ,7.4,.36,1.8,curb).name='gate-stone-plinth';
  box(stoneX,signY,stoneZ,signW,signH,1.5,signBase).name='vju-gate-dark-nameplate';
  collider(stoneX,stoneZ,11.2,2,tr('Bia đá tên trường'));
  // Widen only the short apron through the opening, tapering to the existing spine.
  const apronGeometry=new THREE.BufferGeometry();
  apronGeometry.setAttribute('position',new THREE.Float32BufferAttribute([
    g.x-6.2,.151,65,g.x+6.2,.151,65,g.x-6.2,.151,57,g.x+6.2,.151,57,
    g.x-4,.151,43,g.x+4,.151,43,
  ],3));
  apronGeometry.setIndex([0,1,2,1,3,2,2,3,4,3,5,4]);apronGeometry.computeVertexNormals();
  const apron=new THREE.Mesh(apronGeometry,asphalt);apron.name='straight-gate-apron';group.add(apron);
  const c = document.createElement('canvas'); c.width = 2040; c.height = 1320;
  const ctx = c.getContext('2d');
  if (ctx) {
    const bounds:{text:string;left:number;right:number;top:number;bottom:number;fontSize:number}[]=[];
    // Measure ink incl. Vietnamese accents AND outline. Never use fillText maxWidth or scale.
    function textFit(text:string,cx:number,cy:number,width:number,height:number,size:number,fill:string,outline=5){
      ctx!.textAlign='left';ctx!.textBaseline='alphabetic';ctx!.lineJoin='round';
      let m:TextMetrics;
      do{ctx!.font=`700 ${size}px Arial`;m=ctx!.measureText(text);if(m.actualBoundingBoxLeft+m.actualBoundingBoxRight+outline<=width&&m.actualBoundingBoxAscent+m.actualBoundingBoxDescent+outline<=height)break;size--;}while(size>8);
      const inkW=m.actualBoundingBoxLeft+m.actualBoundingBoxRight,inkH=m.actualBoundingBoxAscent+m.actualBoundingBoxDescent;
      const x=cx-inkW/2+m.actualBoundingBoxLeft,y=cy+(m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2;
      ctx!.strokeStyle='#e6e8e4';ctx!.lineWidth=outline;ctx!.strokeText(text,x,y);ctx!.fillStyle=fill;ctx!.fillText(text,x,y);
      bounds.push({text,left:cx-(inkW+outline)/2,right:cx+(inkW+outline)/2,top:cy-(inkH+outline)/2,bottom:cy+(inkH+outline)/2,fontSize:size});
    }
    // Vector reconstruction of the VJU lockup, for this model (not a certified logo master).
    ctx.fillStyle='#d70d27';ctx.strokeStyle='#e1e7ec';ctx.lineWidth=4;ctx.beginPath();ctx.arc(820,205,113,0,Math.PI*2);ctx.fill();ctx.stroke();
    function petal(x:number,y:number,angle:number,length:number,width:number){ctx!.save();ctx!.translate(x,y);ctx!.rotate(angle);ctx!.beginPath();ctx!.moveTo(0,0);ctx!.bezierCurveTo(-width,-length*.45,-width*.6,-length,0,-length);ctx!.bezierCurveTo(width*.6,-length,width,-length*.45,0,0);ctx!.fillStyle='#174c5b';ctx!.fill();ctx!.strokeStyle='#e3e9ed';ctx!.lineWidth=3;ctx!.stroke();ctx!.restore();}
    for(let i=0;i<5;i++)petal(854,164,i*Math.PI*2/5,43,15);
    for(const angle of [-1.1,-.55,0,.55,1.1])petal(789,269,angle,69,15);
    ctx.strokeStyle='#e7e3e7';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(959,101);ctx.lineTo(959,307);ctx.stroke();
    textFit('VJU',1148,170,345,147,150,'#14494c',7);
    textFit('Vietnam Japan University',1158,264,380,31,29,'#164653',3);
    textFit('VNU since 1906',1084,298,230,24,23,'#174758',2);
    textFit(tr('ĐẠI HỌC QUỐC GIA HÀ NỘI'),1020,436,1540,90,83,'#c90929',6);
    textFit(tr('TRƯỜNG ĐẠI HỌC VIỆT NHẬT'),1020,608,1900,170,158,'#ce0827',9);
    textFit('VNU Vietnam Japan University',1020,785,1700,116,111,'#104451',7);
    const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy=8;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(signW,signH),new THREE.MeshStandardMaterial({map,transparent:true,roughness:.42,metalness:.08,depthWrite:false,emissive:0x000000}));
    face.name='gate-stone-inscription';
    face.userData={textBounds:bounds,canvas:[c.width,c.height],reference:'10d8e061-a792-46cd-8224-378cf94bf158.png',logo:'vector approximation from photograph'};
    face.position.set(stoneX,signY,stoneZ+.756);
    group.add(face);
  }
  // Independent wide photo e8ee4a77 confirms the main pier rises above the low stele.
  // Visual height is an estimate, not a Street View measurement. XZ footprint, opening
  // and collision stay identical. The smaller fence posts remain warm beige.
  const pierJoint=new THREE.MeshStandardMaterial({color:0x171b1c,roughness:.92});
  const pierFaces=[0x30363a,0x343b3e,0x2a3033,0x31373a,0x2b3033]
    .map(color=>new THREE.MeshPhysicalMaterial({color,roughness:.39,metalness:.06,clearcoat:.18,clearcoatRoughness:.35,envMap:env,envMapIntensity:.22}));
  const pierWidth=1.2,pierHeight=5.6,joint=.024,courseHeight=pierHeight/pierFaces.length;
  for(const x of [g.x-7,g.x+7]){
    const z=g.z+2.8;
    box(x,pierHeight/2,z,pierWidth-.022,pierHeight-.002,pierWidth-.022,pierJoint).name='gate-square-pillar';
    for(const [i,material] of pierFaces.entries()){
      const h=courseHeight-(i===pierFaces.length-1?0:joint);
      box(x,i*courseHeight+h/2,z,pierWidth,h,pierWidth,material).name='gate-pier-stone-course';
    }
    collider(x,g.z+2.8,1.2,1.2,'Gate pillar');
    // Open leaves lie alongside the entry lane, pointing inward; no overhead arch.
    const side=Math.sign(x-g.x),leafX=x-side*.66,leafZ=g.z+.55;
    for(const y of [.42,2.65])box(leafX,y,leafZ,.14,.14,4.5,gateMetal);
    for(let i=0;i<=9;i++)box(leafX,1.54,g.z+2.8-i*.5,.11,2.3,.1,gateMetal);
    collider(leafX,leafZ,.16,4.6,'Gate open leaf');
  }
  group.add(createGateFlags(pierHeight));
  for(const x of [g.x-16.5,g.x+16.5]){
    box(x,.45,g.z+2.8,11,.9,.5,cream).name='gate-fence-cream-base';
    for(const y of [1.08,2.5])box(x,y,g.z+2.8,11,.09,.09,gateMetal).name='gate-fence-rail';
    for(let i=0;i<=24;i++)box(x-5.5+i*11/24,1.75,g.z+2.8,.09,1.8,.09,gateMetal).name='gate-fence-picket';
    for(const side of [-1,1])box(x+side*5.5,1.5,g.z+2.8,.45,3,.6,gateTerra).name='gate-fence-earth-post';
    collider(x,g.z+2.8,11,.5,'Gate side wall');
  }
  return { group, colliders };
}
