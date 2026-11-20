import {STAGE} from './stageLayout';
import {createStageSeating} from './stageSeating';
import {createStageBackdrop} from './stageBackdrop';
import {createNamedGarden} from './namedGarden';
import type {FlowerLoopState} from './flowerLoop';
import {BOARD,GARDEN} from './festivalLayout';
import {createStickerBoard} from './stickerBoard';
import {createGardenLandscape} from './gardenLandscape';
import {loadHeroBouquet} from './heroBouquet';
import * as THREE from 'three';
import type { Collider } from '../types';
import { createRouteArt } from './routeArt';
import { createPickingGarden } from './flowerGarden';
import {createGardenSign} from './gardenSign';
import type { FlowerKind } from '../greetings/flowers';
import { createFestivalAtmosphere } from './atmosphere';
import { createFinaleFireworks } from './finaleFireworks';
import {createFinaleLettering} from './finaleLettering';
import {createFinaleSky} from './finaleSky';
import {createFinaleLogo} from './finaleLogo';
import {createReflectionBoard} from './reflectionBoard';

export interface PublicFestivalCard {
  message: string;
  signature?: string;
  recipientName?: string;
  isSample?: boolean;
  bouquet?: FlowerKind[];
}

/** An additive layer. No existing campus geometry or resources are mutated. */
export function createFestivalScene(campus?: THREE.Object3D) {
  const group = new THREE.Group(); group.name = 'festival';
  const colliders: Collider[] = [];
  const routeArt=createRouteArt(campus);group.add(routeArt.group);colliders.push(...routeArt.colliders);
  const atmosphere=createFestivalAtmosphere();group.add(atmosphere.group);colliders.push(...atmosphere.colliders);
  const reflectionBoard=createReflectionBoard();group.add(reflectionBoard.group);colliders.push(...reflectionBoard.colliders);
  const fireworks=createFinaleFireworks();group.add(fireworks.points);
  const finaleSky=createFinaleSky();group.add(finaleSky.group);const emblem=createFinaleLogo();group.add(emblem.points);
  const landmarks = { board: new THREE.Vector3(BOARD.x, 0, BOARD.z), garden: new THREE.Vector3(GARDEN.x, 0, GARDEN.z), stage: new THREE.Vector3(STAGE.x, 0, STAGE.z) };
  const cream = new THREE.MeshStandardMaterial({ color: 0xf4e5c4, roughness: .86 });
  const red = new THREE.MeshStandardMaterial({ color: 0x963e3d, roughness: .82 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x73553f, roughness: .95 });
  const green = new THREE.MeshStandardMaterial({ color: 0x526b4a, roughness: .9 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffe3a1, emissive: 0xffbf55, emissiveIntensity: 1.15, roughness: .55 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function box(parent: THREE.Object3D, name: string, x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material) {
    const mesh = new THREE.Mesh(boxGeo, material); mesh.name = name; mesh.position.set(x,y,z); mesh.scale.set(w,h,d); mesh.castShadow = h > .5; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function solid(x: number, z: number, w: number, d: number, label: string) {
    colliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,label});
  }
  const stamp = new THREE.Object3D();
  function instances(name: string, geometry: THREE.BufferGeometry, material: THREE.Material, specs: {x:number;y:number;z:number;sx:number;sy:number;sz:number;ry?:number;color?:number}[]) {
    const mesh = new THREE.InstancedMesh(geometry, material, specs.length); mesh.name = name;
    specs.forEach((p,i)=>{stamp.position.set(p.x,p.y,p.z);stamp.rotation.set(0,p.ry??0,0);stamp.scale.set(p.sx,p.sy,p.sz);stamp.updateMatrix();mesh.setMatrixAt(i,stamp.matrix);if(p.color!==undefined)mesh.setColorAt(i,new THREE.Color(p.color));});
    mesh.instanceMatrix.needsUpdate=true; mesh.receiveShadow=true;group.add(mesh);return mesh;
  }


  // Owner correction: keep the gate and courtyard open, without bollard rows
  // inventing a corridor across the square. Light only the activity areas below.

  const boardArt=createStickerBoard(),board=boardArt.group;board.position.copy(landmarks.board);group.add(board);
  solid(BOARD.x,BOARD.z,BOARD.width,BOARD.depth,'Bảng Tri Ân');
  // The 3D board uses its own ordered public page API. The 2D list is independent.
  function setPublicCards(_cards:PublicFestivalCard[]) {}
  const landscape=createGardenLandscape();group.add(landscape.group);colliders.push(...landscape.colliders);
  const picking=createPickingGarden(),namedGarden=createNamedGarden();group.add(picking.group,namedGarden.group);colliders.push(...namedGarden.colliders);
  const loadPlanter=loadHeroBouquet(group);
  const hero=new THREE.Group();hero.name='wish-bloom-after-confirmed-send';hero.position.set(34,.65,6);hero.visible=false;group.add(hero);
  box(hero,'flower-stem',0,1,0,.1,2,.1,green);
  for(let i=0;i<7;i++) {
    const angle=i*Math.PI*2/7,petal=new THREE.Mesh(new THREE.SphereGeometry(.48,8,6),i%2?cream:red);
    petal.position.set(Math.cos(angle)*.57,2.08,Math.sin(angle)*.57);petal.scale.y=.4;hero.add(petal);
  }
  const flowerCentre=new THREE.Mesh(new THREE.SphereGeometry(.3,8,6),glow);flowerCentre.position.y=2.17;hero.add(flowerCentre);hero.scale.setScalar(.48);
  const gardenSign=createGardenSign('VƯỜN HOA TRI ÂN','HÁI HOA & GỬI TẶNG',8,1.1);
  gardenSign.name='garden-title-sign';gardenSign.position.set(34,.95,7.7);gardenSign.rotation.x=-.2;group.add(gardenSign);

  // Stage moves into the open west courtyard; audience faces north, with a centre aisle.
  const stage=new THREE.Group();stage.name='festival-stage';stage.position.x=STAGE.x;group.add(stage);
  box(stage,'stage-platform',0,.795,-18,18,1.15,6,wood);solid(STAGE.x,-18,18,6,'Sân khấu tri ân');
  box(stage,'stage-curtain',0,4.37,-20.8,17,6,.15,cream);
  for(const x of [-8.2,8.2]) {box(stage,'stage-red-curtain',x,4.37,-20.55,1.1,6,.2,red);box(stage,'stage-post',x,4.155,-19.9,.24,7.35,.24,wood);}
  const stageSign=createStageBackdrop();stageSign.position.set(0,4.37,-20.68);stage.add(stageSign);
  const bulbs:{x:number;y:number;z:number;sx:number;sy:number;sz:number}[]=[];
  for(let i=0;i<27;i++){const x=STAGE.x-8.2+i*16.4/26;bulbs.push({x,y:7.7-.35*Math.sin(i/26*Math.PI),z:-19.9,sx:.12,sy:.12,sz:.12});}
  instances('stage-string-lights',new THREE.SphereGeometry(1,6,4),glow,bulbs);
  const stageCable=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bulbs.map(b=>new THREE.Vector3(b.x,b.y+.13,b.z))),40,.018,4,false),wood);stageCable.name='stage-supported-light-cable';group.add(stageCable);
  const seating=createStageSeating();group.add(seating.group);colliders.push(...seating.colliders);
  // The freestanding photo banner and both post colliders were removed by request.
  for(const [x,y,z,intensity,range] of [[0,6,12,65,20],[34,5,-2,65,22],[STAGE.x,7,-15,100,28]]) {
    const light=new THREE.PointLight(0xffd191,intensity,range,2);light.position.set(x,y,z);light.castShadow=false;group.add(light);
  }

  // Preserve the original sparks-forming-20.11 concept, with fireworks behind it.
  const closing=createFinaleLettering(),finale=closing.points;group.add(finale);
  let reducedMotion=true,bloomElapsed=0,bloomActive=false,bloomStart=.48;
  function bloom() {hero.visible=true;bloomStart=.48;bloomElapsed=0;bloomActive=!reducedMotion;hero.scale.setScalar(reducedMotion?1:bloomStart);}
  function setFinale(progress:number|null,reduce:boolean,aspect=1,budget=11500) {
    reducedMotion=reduce;fireworks.setProgress(progress,reduce,aspect,budget);finaleSky.setProgress(progress,reduce);emblem.setProgress(progress,reduce,aspect);
    if(reduce&&bloomActive){bloomActive=false;hero.scale.setScalar(1);}
    closing.setProgress(progress,reduce,aspect,budget);
  }
  function update(dt:number) {
    namedGarden.update(dt,reducedMotion);
    if(!bloomActive)return;bloomElapsed+=Math.max(0,Math.min(dt,.1));
    const t=THREE.MathUtils.smoothstep(bloomElapsed,0,1.6);hero.scale.setScalar(THREE.MathUtils.lerp(bloomStart,1,t));
    if(t>=1)bloomActive=false;
  }
  return {group,colliders,board,reflectionBoard,setBoardPage:boardArt.setPage,finale,finaleFireworksState:()=>fireworks.state?.(),finaleLetteringState:()=>closing.state?.(),finaleSkyState:()=>finaleSky.state(),finaleLogoState:()=>emblem.state(),flowerTargets:picking.targets,stageSign,plotTargets:namedGarden.targets,setPlotTarget:namedGarden.setTarget,setGardenTotal:namedGarden.setTotal,setFlowers(state:FlowerLoopState){picking.setStock(state.stock);namedGarden.setState(state);},landmarks,update,bloom,setPublicCards,setFinale,setPresentation:(enabled:boolean)=>{routeArt.setEnabled(enabled);if(enabled)void loadPlanter();},replacesCollider:routeArt.replacesCollider};
}
