import {tr} from '../i18n/index.ts';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {FLOWERS,type FlowerKind} from '../greetings/flowers';
import {createBouquetVisual,disposeBouquetVisual} from './bouquetVisual';
import {PICK_PATCHES,GARDEN,GARDEN_PLOTS} from './festivalLayout';
import {FLOWER_KINDS} from './flowerLoop';
import {createGardenSign} from './gardenSign';

/** Merge each botanical species once; instance it for picking and permanent borders. */
/** Merge each botanical species once; instance it for picking and permanent borders. */
export function createPickingGarden(){
  const group=new THREE.Group();group.name='picking-flower-garden';
  const targets:THREE.Object3D[]=[],stamp=new THREE.Object3D(),matrix=new THREE.Matrix4();
  const patches:{kind:FlowerKind;meshes:THREE.InstancedMesh[];matrices:THREE.Matrix4[]}[]=[];
  let seed=2011;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  FLOWER_KINDS.forEach((kind,row)=>{
    const patch=new THREE.Group();patch.name=`pick-${kind}`;patch.userData.flowerKind=kind;group.add(patch);targets.push(patch);
    const [cx,cz]=PICK_PATCHES[row],definition=FLOWERS[kind];
    const source=createBouquetVisual([kind]);source.updateMatrixWorld(true);
    const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
    source.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const material=o.material as THREE.Material;const parts=batches.get(material)??[];
      if(o instanceof THREE.InstancedMesh){for(let i=0;i<o.count;i++){o.getMatrixAt(i,matrix);const g=o.geometry.clone().applyMatrix4(matrix).applyMatrix4(o.matrixWorld);parts.push(g.index?g.toNonIndexed():g);}}
      else {const g=o.geometry.clone().applyMatrix4(o.matrixWorld);parts.push(g.index?g.toNonIndexed():g);}batches.set(material,parts);
    });
    const matrices:THREE.Matrix4[]=[],meshes:THREE.InstancedMesh[]=[];
    for(let i=0;i<16;i++){const a=i*2.39996,r=Math.sqrt((i+.5)/16)*1.65;stamp.position.set(cx+Math.cos(a)*r,.82,cz+Math.sin(a)*r*.63);stamp.rotation.set(0,random()*Math.PI*2,0);stamp.scale.setScalar((kind==='sunflower'?2.2:2.0)*( .8+random()*.35));stamp.updateMatrix();matrices.push(stamp.matrix.clone());}
    // Planted borders keep the island lush even when all 16 harvestable flowers are picked.
    const scenery:THREE.Matrix4[]=[];
    for(let i=0;i<30;i++){
      let x:number,z:number;do{const a=random()*Math.PI*2,r=.45+random()*.48;x=GARDEN.x+Math.cos(a)*GARDEN.rx*r;z=GARDEN.z+Math.sin(a)*GARDEN.rz*r;}while(GARDEN_PLOTS.some(([px,pz])=>Math.hypot(x-px,z-pz)<2.3)||PICK_PATCHES.some(([px,pz])=>Math.hypot(x-px,z-pz)<1.7));
      stamp.position.set(x,.72,z);stamp.rotation.set(0,random()*Math.PI*2,0);stamp.scale.setScalar(1.3+random()*.8);stamp.updateMatrix();scenery.push(stamp.matrix.clone());
    }
    for(const [material,parts] of batches){const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());const mat=material.clone();const picked=new THREE.InstancedMesh(geometry,mat,16);matrices.forEach((m,i)=>picked.setMatrixAt(i,m));picked.receiveShadow=true;patch.add(picked);meshes.push(picked);
      const border=new THREE.InstancedMesh(geometry,mat,scenery.length);scenery.forEach((m,i)=>border.setMatrixAt(i,m));border.name=`perennial-${kind}`;group.add(border);
    }
    disposeBouquetVisual(source);patches.push({kind,meshes,matrices});
    const sign=createGardenSign(definition.name,tr('Chạm để hái'),2.5,.9);sign.name=`flower-sign-${kind}`;const north=cz<GARDEN.z;sign.position.set(cx,1.5,cz+(north?-1.45:1.45));sign.rotation.set(north?.25:-.25,north?Math.PI:0,0);patch.add(sign);
    const hit=new THREE.Mesh(new THREE.BoxGeometry(3.4,2.6,2.5),new THREE.MeshBasicMaterial({visible:false}));hit.position.set(cx,1.4,cz);patch.add(hit);
  });
  let previous='';const zero=new THREE.Matrix4().makeScale(0,0,0);
  function setStock(stock:Record<FlowerKind,number>){const key=JSON.stringify(stock);if(previous===key)return;previous=key;for(const p of patches)for(const mesh of p.meshes){for(let i=0;i<16;i++)mesh.setMatrixAt(i,i<16-stock[p.kind]?zero:p.matrices[i]);mesh.instanceMatrix.needsUpdate=true;}}
  return {group,targets,setStock};
}
