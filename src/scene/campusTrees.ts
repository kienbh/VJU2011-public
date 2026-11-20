import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Street trees for the daytime campus: tapered trunk, forked limbs and alpha-cut leaf sprays.
 * A few shared variants keep it to two draw calls per tree, each mesh still hideable on its own.
 */
export function createCampusTreeKit(style:'street'|'pine'|'maple'='street'){
  let seed=20111;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const bark=new THREE.MeshStandardMaterial({color:0x6b5a48,roughness:.95});bark.name='campus-tree-bark';
  const barkCanvas=document.createElement('canvas');barkCanvas.width=128;barkCanvas.height=256;const bc=barkCanvas.getContext('2d')!;bc.fillStyle='#808080';bc.fillRect(0,0,128,256);for(let i=0;i<64;i++){bc.strokeStyle=i%2?'#e1e1e129':'#23232333';bc.beginPath();bc.moveTo(i*2,0);bc.bezierCurveTo(i*2+4,80,i*2-4,160,i*2,256);bc.stroke();}bark.bumpMap=new THREE.CanvasTexture(barkCanvas);bark.bumpScale=.055;
  // Leaf cluster card: many small leaves with gaps, so the crown edge reads as foliage, not a blob.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d')!;
  for(let i=0;i<70;i++){
    const a=random()*Math.PI*2,r=Math.sqrt(random())*98,x=128+Math.cos(a)*r,y=128+Math.sin(a)*r;
    ctx.save();ctx.translate(x,y);ctx.rotate(a+random());
    ctx.beginPath();if(style==='maple'){for(let k=0;k<14;k++){const a=k*Math.PI/7,r=k%2?6:19;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();}else ctx.ellipse(0,0,style==='pine'?2:7+random()*5,style==='pine'?19:15+random()*9,0,0,Math.PI*2);
    ctx.fillStyle=['#f2f5e4','#d9e3c6','#bccba6'][i%3];ctx.fill();
    ctx.strokeStyle='#8a9a72';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(0,14);ctx.stroke();ctx.restore();
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
  const leaf=new THREE.MeshStandardMaterial({map,alphaTest:.45,side:THREE.DoubleSide,vertexColors:true,roughness:.95});leaf.name='campus-tree-leaves';
  leaf.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>', 'float coverage=smoothstep(1.5,4.0,length(vViewPosition));float screenDoor=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453);if(coverage<screenDoor)discard;\n#include <alphatest_fragment>');};leaf.customProgramCacheKey=()=> 'campus-tree-camera-dither-v2';

  function limb(parts:THREE.BufferGeometry[],a:THREE.Vector3,b:THREE.Vector3,r0:number,r1:number){
    const g=new THREE.CylinderGeometry(r1,r0,a.distanceTo(b),7,1,true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize()));
    const mid=a.clone().lerp(b,.5);g.translate(mid.x,mid.y,mid.z);parts.push(g);
  }
  function variant(height:number,radius:number,density:number,hue:number){
    const wood:THREE.BufferGeometry[]=[],cards:THREE.BufferGeometry[]=[];
    const fork=new THREE.Vector3((random()-.5)*.3,height*.5,(random()-.5)*.3),top=new THREE.Vector3(fork.x*1.6,height*.86,fork.z*1.6);
    limb(wood,new THREE.Vector3(0,0,0),fork,.27,.19);limb(wood,fork,top,.19,.09);
    // Root flare keeps the trunk from looking like a pole stuck in the ground.
    const flare=new THREE.CylinderGeometry(.27,.42,.35,7,1,true);flare.translate(0,.17,0);wood.push(flare);
    const tips:THREE.Vector3[]=[top];
    const limbs=style==='pine'?9:5+Math.floor(random()*2),turn=random()*Math.PI*2;
    for(let i=0;i<limbs;i++){
      const a=turn+i*Math.PI*2/limbs+(random()-.5)*.5,start=fork.clone().lerp(top,random()*.45);
      const tip=new THREE.Vector3(Math.cos(a)*radius*(style==='pine'?.88-Math.floor(i/3)*.16:.5+random()*.25),height*(style==='pine'?.51+Math.floor(i/3)*.17:.72+random()*.2),Math.sin(a)*radius*(style==='pine'?.88-Math.floor(i/3)*.16:.5+random()*.25));
      limb(wood,start,tip,.12,.05);tips.push(tip);
      const twig=tip.clone().add(new THREE.Vector3(Math.cos(a+.7)*radius*.3,radius*.2,Math.sin(a+.7)*radius*.3));
      limb(wood,start.clone().lerp(tip,.6),twig,.06,.03);tips.push(twig);
    }
    const stamp=new THREE.Object3D(),color=new THREE.Color();
    for(let i=0;i<density;i++){
      const tip=tips[i%tips.length],a=random()*Math.PI*2,elev=(random()-.35)*Math.PI*.7,d=Math.cbrt(random())*radius*.5;
      const size=.95+random()*.85;
      const card=mergeGeometries([new THREE.PlaneGeometry(size,size),new THREE.PlaneGeometry(size,size).rotateY(Math.PI/2),new THREE.PlaneGeometry(size,size).rotateX(-Math.PI/2)])!;
      stamp.position.set(tip.x+Math.cos(a)*Math.cos(elev)*d,tip.y+Math.sin(elev)*d*(style==='pine'?.22:.8)+radius*.12,tip.z+Math.sin(a)*Math.cos(elev)*d);
      stamp.rotation.set(random()*Math.PI,random()*Math.PI,random()*Math.PI);stamp.updateMatrix();card.applyMatrix4(stamp.matrix);
      // Darker inside and underneath, lighter on the sunlit outer sprays.
      const lift=THREE.MathUtils.clamp((stamp.position.y-height*.6)/(radius*1.2),0,1);
      color.setHSL(style==='maple'?.015+random()*.025:hue+random()*.035,style==='maple'?.58:.29+random()*.14,style==='maple'?.31+lift*.12:.23+lift*.13+random()*.05);
      const count=card.getAttribute('position').count,colors=new Float32Array(count*3);
      for(let v=0;v<count;v++)colors.set([color.r,color.g,color.b],v*3);
      card.setAttribute('color',new THREE.BufferAttribute(colors,3));cards.push(card);
    }
    const trunk=mergeGeometries(wood)!,crown=mergeGeometries(cards)!;
    wood.forEach(g=>g.dispose());cards.forEach(g=>g.dispose());
    return {trunk,crown};
  }
  const variants=style==='street'?[variant(6.3,2.1,58,.25),variant(4.7,2.4,48,.22),variant(7.1,1.25,48,.29),variant(5.3,1.6,42,.26)]:[variant(6.3,2.1,52,.25),variant(5.3,1.8,45,.26)];
  return function createTree(x:number,z:number){
    const pick=variants[Math.abs(Math.round(x*7+z*13))%variants.length],scale=.92+.16*Math.abs(Math.sin(x*.73+z*.41));
    return [pick.trunk,pick.crown].map((geometry,i)=>{
      const mesh=new THREE.Mesh(geometry,i===0?bark:leaf);
      mesh.position.set(x,.12,z);mesh.rotation.y=x*.37+z*.11;mesh.scale.set(scale,scale,scale*(.82+.15*Math.abs(Math.sin(x))));
      mesh.castShadow=true;mesh.name=i===0?'campus-tree-trunk':'campus-tree-crown';mesh.userData.campusTree=true;
      return mesh;
    });
  };
}
