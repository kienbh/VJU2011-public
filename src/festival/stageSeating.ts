import {tr} from '../i18n/index.ts';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import type {Collider} from '../types';
import {STAGE_SEATS} from './stageLayout';

export function createStageSeating(){
  const group=new THREE.Group();group.name='stage-audience-seating';
  const colliders:Collider[]=[];
  const frame=new THREE.MeshStandardMaterial({color:0x535c5b,roughness:.65,metalness:.3});
  const fabric=new THREE.MeshStandardMaterial({color:0x476968,roughness:.95});
  const seatGeo=new RoundedBoxGeometry(1.12,.14,1.02,2,.05);
  const backGeo=new RoundedBoxGeometry(1.12,.8,.12,2,.05);
  const legGeo=new THREE.BoxGeometry(.075,.35,.075);
  const barGeo=new THREE.BoxGeometry(.065,.9,.065);
  for(const seat of STAGE_SEATS){
    const chair=new THREE.Group();chair.name=seat.id;chair.position.set(seat.x,0,seat.z);
    chair.userData.seatId=seat.id;group.add(chair);
    const cushion=new THREE.Mesh(seatGeo,fabric);cushion.position.y=.57;chair.add(cushion);
    const back=new THREE.Mesh(backGeo,fabric);back.position.set(0,1.05,.48);chair.add(back);
    for(const x of [-.44,.44])for(const z of [-.39,.39]){
      const leg=new THREE.Mesh(legGeo,frame);leg.position.set(x,.395,z);chair.add(leg);
    }
    for(const x of [-.44,.44]){const bar=new THREE.Mesh(barGeo,frame);bar.position.set(x,.97,.51);chair.add(bar);}
    colliders.push({minX:seat.x-.57,maxX:seat.x+.57,minZ:seat.z-.52,maxZ:seat.z+.57,maxY:1.45,label:tr('Ghế sân khấu {0}',{0:seat.number})});
  }
  return {group,colliders};
}
