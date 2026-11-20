import * as THREE from 'three';
import {FLOWERS,readFlowers,type FlowerKind} from '../greetings/flowers';

/** Original procedural flowers. Origin is the stem grip; +Y points to blooms.
 * Geometry/materials belong to this group, so dispose it when replacing it.
 * No texture/network/GLB dependency. Safe to use for held and planted bouquets. */
export function createBouquetVisual(flowers:readonly FlowerKind[]):THREE.Group {
  const group=new THREE.Group();group.name='bouquet-visual';
  const kinds=readFlowers(flowers);group.userData.flowers=[...kinds];
  const green=new THREE.MeshStandardMaterial({color:'#477447',roughness:.86});
  const leafGreen=new THREE.MeshStandardMaterial({color:'#608b4b',roughness:.8,side:THREE.DoubleSide});
  const stemGeometry=new THREE.CylinderGeometry(.008,.011,1,6);
  const leafGeometry=petalGeometry(.065,.15,.025);
  const dummy=new THREE.Object3D();
  const positions=[[0,.58,0],[-.19,.48,-.08],[.19,.51,-.07],[-.13,.40,.15],[.15,.43,.16]];
  kinds.forEach((kind,index)=>{
    const flower=new THREE.Group();flower.name=`flower-${index}-${kind}`;flower.userData.flowerKind=kind;group.add(flower);
    const [x,y,z]=positions[index];
    const end=new THREE.Vector3(x,y,z),start=new THREE.Vector3(x*.08,-.15,z*.08);
    const stem=new THREE.Mesh(stemGeometry,green);stem.position.copy(start).add(end).multiplyScalar(.5);stem.scale.y=end.distanceTo(start);stem.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.clone().sub(start).normalize());flower.add(stem);
    for(let l=0;l<2;l++){
      const leaf=new THREE.Mesh(leafGeometry,leafGreen),t=.28+l*.22;
      leaf.position.copy(start).lerp(end,t);leaf.rotation.set(-.4,l*Math.PI+index*1.3,.65);flower.add(leaf);
    }
    const head=new THREE.Group();head.name=`bloom-${kind}`;head.position.copy(end);head.rotation.set(z*.9,0,-x*.8);flower.add(head);
    const definition=FLOWERS[kind];
    const petalMaterial=new THREE.MeshStandardMaterial({color:definition.color,roughness:.68,side:THREE.DoubleSide});
    const coreMaterial=new THREE.MeshStandardMaterial({color:definition.centre,roughness:.9});
    if(kind==='lavender'){
      // Slender flower spike with separate whorls, unlike a rose or disk flower.
      const florets=new THREE.InstancedMesh(new THREE.SphereGeometry(.028,8,6),petalMaterial,35);
      for(let i=0;i<35;i++){const a=i*2.4,t=Math.floor(i/5)/7,r=.045*(1-t*.65);dummy.position.set(Math.cos(a)*r,.02+t*.24,Math.sin(a)*r);dummy.rotation.set(0,a,.3);dummy.scale.set(1-t*.25,1.3,1-t*.25);dummy.updateMatrix();florets.setMatrixAt(i,dummy.matrix);}head.add(florets);
    }else if(kind==='tulip'||kind==='lotus'){
      // Tulip: one upright cup of six. Lotus: an open outer whorl around a raised inner one.
      const tulip=kind==='tulip',rings=tulip?1:2,per=tulip?6:9;
      const petals=new THREE.InstancedMesh(petalGeometry(tulip?.075:.06,tulip?.16:.15,tulip?.07:.04),petalMaterial,rings*per);
      for(let ring=0;ring<rings;ring++)for(let p=0;p<per;p++){
        const a=p*Math.PI*2/per+ring*.35;
        dummy.position.set(Math.sin(a)*.022,ring*.015,Math.cos(a)*.022);dummy.rotation.set(tulip?-1.2:ring?-.95:-.3,a,0);dummy.scale.setScalar(1-ring*.22);dummy.updateMatrix();petals.setMatrixAt(ring*per+p,dummy.matrix);
      }
      head.add(petals);
      const core=new THREE.Mesh(new THREE.SphereGeometry(tulip?.02:.04,12,8),coreMaterial);core.scale.y=tulip?1:.55;core.position.y=.03;head.add(core);
    }else if(kind==='rose'){
      // Three offset, cupped whorls and a closed bud, not a recoloured daisy.
      const petals=new THREE.InstancedMesh(petalGeometry(.085,.13,.052),petalMaterial,21);
      let n=0;
      for(let ring=0;ring<3;ring++)for(let p=0;p<7;p++){
        const a=p*Math.PI*2/7+ring*.46,r=.055-ring*.016;
        dummy.position.set(Math.sin(a)*r,ring*.028,Math.cos(a)*r);dummy.rotation.set(-.45-ring*.3,a,0);dummy.scale.setScalar(1-ring*.2);dummy.updateMatrix();petals.setMatrixAt(n++,dummy.matrix);
      }
      head.add(petals);
      const bud=new THREE.Mesh(new THREE.SphereGeometry(.04,12,8),coreMaterial);bud.scale.set(.7,1.2,.7);bud.position.y=.082;head.add(bud);
    }else{
      const sunflower=kind==='sunflower',count=kind==='bidens'?5:sunflower?17:kind==='cosmos'?8:kind==='chrysanthemum'?24:14,r=sunflower?.078:.04;
      const petals=new THREE.InstancedMesh(petalGeometry(sunflower?.035:kind==='bidens'?.045:kind==='cosmos'?.065:.027,sunflower?.14:kind==='cosmos'?.14:.115,sunflower?.018:.01),petalMaterial,count);
      for(let p=0;p<count;p++){
        const a=p*Math.PI*2/count;
        dummy.position.set(Math.sin(a)*r,0,Math.cos(a)*r);dummy.rotation.set(sunflower?-.12:.1,a,0);dummy.scale.setScalar(1+(p%3-1)*.04);dummy.updateMatrix();petals.setMatrixAt(p,dummy.matrix);
      }
      head.add(petals);
      const core=new THREE.Mesh(new THREE.SphereGeometry(sunflower?.086:.043,16,8),coreMaterial);core.scale.y=sunflower?.29:.45;core.position.y=.014;head.add(core);
      if(sunflower){
        const seeds=new THREE.InstancedMesh(new THREE.SphereGeometry(.008,5,4),new THREE.MeshStandardMaterial({color:'#ac8951',roughness:1}),24);
        for(let s=0;s<24;s++){const a=s*2.39996,rad=.068*Math.sqrt(s/24);dummy.position.set(Math.cos(a)*rad,.038,Math.sin(a)*rad);dummy.rotation.set(0,a,0);dummy.scale.set(1,.45,1);dummy.updateMatrix();seeds.setMatrixAt(s,dummy.matrix);}head.add(seeds);
      }
    }
  });
  // Narrow gathered tie leaves stems and each distinct flower visible.
  if(kinds.length){
    const tie=new THREE.Mesh(new THREE.TorusGeometry(.035,.009,5,14),new THREE.MeshStandardMaterial({color:'#ba8c76',roughness:.9}));tie.rotation.x=Math.PI/2;tie.position.y=.045;group.add(tie);
  }
  return group;
}

/** Curved leaf/petal, pointed ends and raised centre vein. */
function petalGeometry(width:number,length:number,cup:number):THREE.BufferGeometry {
  const positions:number[]=[],indices:number[]=[];
  for(let row=0;row<=6;row++)for(let col=0;col<=4;col++){
    const t=row/6,s=col/2-1,w=Math.sin(Math.PI*t)*width;
    positions.push(s*w,cup*t*t+.012*(1-s*s)*Math.sin(Math.PI*t),t*length);
  }
  for(let row=0;row<6;row++)for(let col=0;col<4;col++){const i=row*5+col;indices.push(i,i+5,i+1,i+1,i+5,i+6);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

export function disposeBouquetVisual(group:THREE.Group):void {
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  group.traverse(object=>{if(object instanceof THREE.Mesh){geometries.add(object.geometry);for(const m of Array.isArray(object.material)?object.material:[object.material])materials.add(m);}});
  geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());group.clear();
}
