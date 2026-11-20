import {tr} from '../i18n/index.ts';
import * as THREE from 'three';
import type {Collider} from '../types';
import {GARDEN,GARDEN_PLOTS} from './festivalLayout';

/** A continuous planted island, with rounded low edging and living groundcover. */
/** A continuous planted island, with rounded low edging and living groundcover. */
export function createGardenLandscape(){
  const group=new THREE.Group();group.name='continuous-flower-garden';
  const outline=new THREE.Shape();
  outline.absellipse(0,0,GARDEN.rx,GARDEN.rz,0,Math.PI*2,false,0);
  const rim=new THREE.Mesh(new THREE.ExtrudeGeometry(outline,{depth:.18,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.08,bevelThickness:.06,curveSegments:64}),new THREE.MeshStandardMaterial({color:0xd0cab7,roughness:.9}));
  rim.rotation.x=-Math.PI/2;rim.position.set(GARDEN.x,.28,GARDEN.z);group.add(rim);
  const earth=new THREE.Mesh(new THREE.CircleGeometry(1,96),new THREE.MeshStandardMaterial({color:0x58664b,roughness:1}));earth.rotation.x=-Math.PI/2;earth.scale.set(GARDEN.rx-.22,GARDEN.rz-.22,1);earth.position.set(GARDEN.x,.55,GARDEN.z);group.add(earth);
  const colliders:Collider[]=[];
  // Narrow strips follow the visible ellipse rather than reserving its empty corners.
  for(let i=0;i<18;i++){const z=-GARDEN.rz+i,y=z+.5,w=GARDEN.rx*Math.sqrt(Math.max(0,1-y*y/(GARDEN.rz*GARDEN.rz)));colliders.push({minX:GARDEN.x-w,maxX:GARDEN.x+w,minZ:GARDEN.z+z,maxZ:GARDEN.z+z+1,label:tr('Vườn hoa liên tục')});}
  const count=1900,leaf=new THREE.InstancedMesh(new THREE.SphereGeometry(1,6,4),new THREE.MeshStandardMaterial({roughness:.9}),count),o=new THREE.Object3D();leaf.name='garden-living-groundcover';
  let seed=20112026;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<count;i++){
    const a=random()*Math.PI*2,r=Math.sqrt(random())*.96,x=GARDEN.x+Math.cos(a)*GARDEN.rx*r,z=GARDEN.z+Math.sin(a)*GARDEN.rz*r;
    const clear=GARDEN_PLOTS.some(([px,pz])=>Math.hypot(x-px,z-pz)<.8);
    o.position.set(x,.5+random()*(clear?.08:.24),z);o.rotation.set(random()*.4,random()*Math.PI,random()*.4);o.scale.set(.25+random()*.22,.055+random()*.065,.10+random()*.15);o.updateMatrix();leaf.setMatrixAt(i,o.matrix);leaf.setColorAt(i,new THREE.Color().setHSL(.22+random()*.10,.26+random()*.25,.19+random()*.13));
  }
  group.add(leaf);return {group,colliders};
}
