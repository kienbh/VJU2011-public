import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** All parts remain inside the existing 0.8 × 9.8 collision reservation. */
export function dressBoardFrame(board:THREE.Group) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#765540';ctx.fillRect(0,0,256,256);
  let seed=2011;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<150;i++){
    const x=random()*256;ctx.strokeStyle=i%2?'rgba(41,25,16,.12)':'rgba(220,178,116,.1)';ctx.lineWidth=.4+random();
    ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x+9,80,x-7,160,x,256);ctx.stroke();
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const timber=new THREE.MeshStandardMaterial({map,roughness:.76,bumpMap:map,bumpScale:.012});
  const brass=new THREE.MeshStandardMaterial({color:0xb39a70,roughness:.55,metalness:.52});
  const stone=new THREE.MeshStandardMaterial({color:0xa9a596,roughness:.91});
  const dark=new THREE.MeshStandardMaterial({color:0x282e2b,roughness:.7});
  const opal=new THREE.MeshBasicMaterial({color:0xcab88e,toneMapped:false});
  const leaf=new THREE.MeshStandardMaterial({color:0x456449,roughness:.94});
  const petal=new THREE.MeshStandardMaterial({color:0xdba566,roughness:.85});
  const red=new THREE.MeshStandardMaterial({color:0xae6054,roughness:.88});
  const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
  function add(g:THREE.BufferGeometry,m:THREE.Material){const list=batches.get(m)??[];list.push(g.index?g.toNonIndexed():g.clone());batches.set(m,list);g.dispose();}
  function box(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material,r=.025){add(new RoundedBoxGeometry(w,h,d,2,r).translate(x,y,z),m);}
  for(const x of [-4.5,4.5]){
    box(x,2.65,0,.39,5.3,.42,timber);box(x,.43,0,.56,.34,.64,stone);
    box(x,.65,0,.43,.08,.48,brass,.008);box(x,5.4,0,.52,.14,.62,timber);
  }
  box(0,3.15,0,9.4,4.2,.36,timber);box(0,5.3,0,9.8,.18,.58,timber);
  for(const side of [-1,1]){
    for(const x of [-4.43,4.43])box(x,3.15,side*.22,.11,4.04,.07,brass,.008);
    for(const y of [1.135,5.165])box(0,y,side*.22,8.9,.08,.07,brass,.008);
    // Shielded strip under the cornice, without additional point lights.
    box(0,5.24,side*.31,8.65,.065,.12,dark,.009);
    box(0,5.197,side*.31,8.38,.012,.065,opal,.003);
  }
  for(const x of [-3.7,3.7]){
    box(x,.51,0,1.36,.42,.69,stone);box(x,.73,0,1.22,.035,.55,dark,.006);
    for(let i=0;i<12;i++){
      const px=x+(random()-.5)*1.07,pz=(random()-.5)*.43,py=.78+random()*.15;
      add(new THREE.SphereGeometry(.14,7,5).scale(1.2,.5,.75).translate(px,py-.04,pz),leaf);
      for(let k=0;k<5;k++){
        const a=k*Math.PI*2/5;
        add(new THREE.SphereGeometry(.065,6,4).scale(1,.5,1).translate(px+Math.cos(a)*.055,py+.055,pz+Math.sin(a)*.055),i%3?petal:red);
      }
    }
  }
  for(const [material,parts] of batches){
    const geometry=mergeGeometries(parts,false)!;parts.forEach(g=>g.dispose());
    const mesh=new THREE.Mesh(geometry,material);mesh.name='board-crafted-frame';mesh.receiveShadow=true;board.add(mesh);
  }
}
