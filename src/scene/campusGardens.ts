import {tr} from '../i18n/index.ts';
import {createCampusTreeKit} from './campusTrees';
import * as THREE from 'three';
import type { Collider } from '../types';

/** Owner-marked planting plots; decorative proposal, not surveyed landscaping. */
/** Owner-marked planting plots; decorative proposal, not surveyed landscaping. */
export function createCampusGardens() {
  const group=new THREE.Group();group.name='clubhouse-and-lab-gardens';
  group.userData={provisionalPlanting:true};
  const colliders:Collider[]=[];
  const material=(color:number)=>new THREE.MeshStandardMaterial({color,roughness:.95});
  const bark=material(0x786348),foliage=material(0x537849),rim=material(0xb7b29b),soil=material(0x655747);
  const flowers:{x:number;y:number;z:number;color:number;size?:number;leafOnly?:boolean}[]=[];
  let seed=1427;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const rounded=(w:number,d:number,r:number)=>{
    const s=new THREE.Shape(),a=-w/2,b=w/2,c=-d/2,e=d/2;
    s.moveTo(a+r,c);s.lineTo(b-r,c);s.quadraticCurveTo(b,c,b,c+r);
    s.lineTo(b,e-r);s.quadraticCurveTo(b,e,b-r,e);s.lineTo(a+r,e);
    s.quadraticCurveTo(a,e,a,e-r);s.lineTo(a,c+r);s.quadraticCurveTo(a,c,a+r,c);s.closePath();return s;
  };
  function flowerBed(name:string,x:number,z:number,w:number,d:number,formal=false){
    const edge=new THREE.Mesh(new THREE.ExtrudeGeometry(rounded(w,d,1.1),{depth:.35,bevelEnabled:false,curveSegments:10}),rim);
    edge.rotation.x=-Math.PI/2;edge.position.set(x,.09,z);edge.receiveShadow=true;edge.castShadow=true;edge.name=name;group.add(edge);
    const earth=new THREE.Mesh(new THREE.ShapeGeometry(rounded(w-.6,d-.6,.8)),soil);
    earth.rotation.x=-Math.PI/2;earth.position.set(x,.45,z);group.add(earth);
    colliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,label:name});
    if(formal){
      // Parterre: a clipped hedge, colour bands that follow the bed outline, and a tiered topiary.
      const bands=[0xd5808f,0xf0e5cf,0xe9c35f,0xa488bb,0xd5808f],step=.5;
      for(let dx=-w/2+.75;dx<=w/2-.74;dx+=step)for(let dz=-d/2+.75;dz<=d/2-.74;dz+=step){
        const inset=Math.min(w/2-Math.abs(dx),d/2-Math.abs(dz)),centre=Math.hypot(dx,dz);
        if(inset<1.05){if(inset<.9)flowers.push({x:x+dx,z:z+dz,y:.86,color:0,size:1.5,leafOnly:true});continue;}
        if(centre<1.5)continue;
        const band=centre<2.6?4:Math.min(3,Math.floor((inset-1.05)/.95));
        flowers.push({x:x+dx+(random()-.5)*.14,z:z+dz+(random()-.5)*.14,y:.66+random()*.06,color:bands[band],size:.92});
      }
      for(const [y,size] of [[1.15,4.2],[1.95,2.9],[2.55,1.8]])flowers.push({x,z,y,color:0,size,leafOnly:true});
      return;
    }
    // Varied clusters of low flowers; leave the rim legible from above.
    for(let i=0;i<Math.round(w*d*1.1);i++)flowers.push({x:x+(random()-.5)*(w-1.5),z:z+(random()-.5)*(d-1.5),y:.7+random()*.3,color:[0xd5808f,0xe9c35f,0xf0e5cf,0xa488bb][Math.floor(random()*4)]});
  }
  flowerBed(tr('Vườn hoa trái Club House'),116,-105,18,7);
  flowerBed(tr('Bồn hoa phụ trái Club House'),139,-100,11,5);
  flowerBed(tr('Vườn hoa trước PTN — trái'),104.5,-47,11,12,true);
  flowerBed(tr('Vườn hoa trước PTN — phải'),125.5,-47,11,12,true);
  const path=new THREE.Mesh(new THREE.BoxGeometry(3,.1,25),rim);
  path.position.set(115,.23,-48);path.name='lab-garden-clear-entrance-path';group.add(path);
  // Short branch behind the flowerbed, clear of both the planting and the road.
  const labBranch=new THREE.Mesh(new THREE.BoxGeometry(11.4,.1,2.4),rim);
  labBranch.position.set(110.5,.23,-59.3);labBranch.name='lab-secondary-entry-path';group.add(labBranch);
  // The tea corner supplies its own broad shade tree; keep neighbouring crowns clear.
  const gardenTrees=createCampusTreeKit();for(const [x,z] of [[97,-106],[151,-105]]){for(const m of gardenTrees(x,z)){m.scale.multiply(new THREE.Vector3(1.5,1.3,1.5));group.add(m);}colliders.push({minX:x-.65,maxX:x+.65,minZ:z-.65,maxZ:z+.65,label:'Club House garden tree'});}
  const stamp=new THREE.Object3D();
  const flowerCanvas=document.createElement('canvas');flowerCanvas.width=flowerCanvas.height=64;const fc=flowerCanvas.getContext('2d')!;fc.fillStyle='#fffaf1';for(let i=0;i<5;i++){const a=i*Math.PI*2/5;fc.beginPath();fc.ellipse(32+Math.cos(a)*13,32+Math.sin(a)*13,13,8,a,0,Math.PI*2);fc.fill();}fc.fillStyle='#e9c675';fc.beginPath();fc.arc(32,32,7,0,Math.PI*2);fc.fill();const flowerTexture=new THREE.CanvasTexture(flowerCanvas);flowerTexture.colorSpace=THREE.SRGBColorSpace;
  const blooms=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({map:flowerTexture,alphaTest:.4,side:THREE.DoubleSide,roughness:1}),flowers.length);
  const greens=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),material(0x54804c),flowers.length);
  flowers.forEach((f,i)=>{
    const size=f.size??1;
    stamp.rotation.set(0,0,0);stamp.position.set(f.x,f.y-.2,f.z);stamp.scale.set(.36*size,(f.leafOnly?.34:.24)*size,.32*size);stamp.updateMatrix();greens.setMatrixAt(i,stamp.matrix);
    stamp.position.y=f.y+.06;stamp.scale.set(.52,.52,.52).multiplyScalar(f.leafOnly?0:size);stamp.rotation.y=random()*Math.PI;stamp.updateMatrix();blooms.setMatrixAt(i,stamp.matrix);blooms.setColorAt(i,new THREE.Color(f.color));
  });blooms.name='clubhouse-lab-flower-colors';greens.userData.qualityDecoration=blooms.userData.qualityDecoration=true;group.add(greens,blooms);

  // Three small bamboo clumps, slender culms with visible nodes and narrow leaves.
  const bamboo=new THREE.Group();bamboo.name='small-bamboo-right-of-clubhouse';group.add(bamboo);
  const stalks:{x:number;z:number;h:number}[]=[];
  for(const [x,z,h] of [[192,-105,4.6],[201,-101,5.4],[192,-97,3.9]]){
    for(let i=0;i<7;i++){const a=i*2.4;stalks.push({x:x+Math.cos(a)*(.35+i*.13),z:z+Math.sin(a)*(.35+i*.13),h:h*(.75+random()*.3)});}
    colliders.push({minX:x-1.3,maxX:x+1.3,minZ:z-1.3,maxZ:z+1.3,label:tr('Bụi tre nhỏ bên phải Club House')});
  }
  const culms=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,7),material(0x6e8b45),stalks.length);
  const nodes=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,7),material(0x9ba56a),stalks.length*6);
  const leaves=new THREE.InstancedMesh(new THREE.SphereGeometry(1,6,4),material(0x416e43),stalks.length*10);
  stalks.forEach((s,i)=>{
    stamp.rotation.set(0,0,0);stamp.position.set(s.x,s.h/2,s.z);stamp.scale.set(.08,s.h,.08);stamp.updateMatrix();culms.setMatrixAt(i,stamp.matrix);
    for(let n=0;n<6;n++){stamp.position.y=s.h*(n+1)/7;stamp.scale.set(.11,.07,.11);stamp.updateMatrix();nodes.setMatrixAt(i*6+n,stamp.matrix);}
    for(let n=0;n<10;n++){const a=n*2.4+i,reach=.4+random()*.6;stamp.position.set(s.x+Math.cos(a)*reach,s.h*(.48+random()*.48),s.z+Math.sin(a)*reach);stamp.rotation.set(.2,-a,(n%2?1:-1)*.4);stamp.scale.set(.75,.075,.19);stamp.updateMatrix();leaves.setMatrixAt(i*10+n,stamp.matrix);}
  });bamboo.add(culms,nodes,leaves);
  for(const mesh of [greens,blooms,culms,nodes,leaves]){mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;}
  return {group,colliders};
}
