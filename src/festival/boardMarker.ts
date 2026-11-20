import {tr} from '../i18n/index.ts';
import * as THREE from 'three';

/** A high blade on the existing board post, facing arrivals from the left turn.
 * No ground footprint or collider, no dynamic light. */
/** A high blade on the existing board post, facing arrivals from the left turn.
 * No ground footprint or collider, no dynamic light. */
export function createBoardMarker(){
  const group=new THREE.Group();group.name='board-arrival-marker';
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#edd6a4';ctx.fillRect(0,0,1024,256);
  ctx.strokeStyle='#9a7850';ctx.lineWidth=10;ctx.strokeRect(8,8,1008,240);
  ctx.fillStyle='#71372f';ctx.font='bold 106px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(tr('BẢNG TRI ÂN'),512,126);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const plate=new THREE.Mesh(new THREE.BoxGeometry(6.4,1.6,.1),new THREE.MeshStandardMaterial({color:0x6f543c,roughness:.8}));plate.position.set(52,6.4,12.5);group.add(plate);
  const text=new THREE.Mesh(new THREE.PlaneGeometry(6.25,1.48),new THREE.MeshBasicMaterial({map,toneMapped:false}));text.position.set(52,6.4,12.558);group.add(text);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,1.8,8),new THREE.MeshStandardMaterial({color:0x806d50,metalness:.5,roughness:.6}));pole.position.set(52,5.8,12.5);group.add(pole);
  return group;
}
