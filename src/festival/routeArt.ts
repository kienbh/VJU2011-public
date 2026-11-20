import {tr} from '../i18n/index.ts';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Collider } from '../types';
import { createGateDressing, slenderGateLamp } from './gateDressing';
import { createSignWash } from './signWash';
import { courtyardPavers } from './courtyardFinish';

/** Local festival dressing only. Campus transforms and daytime resources are preserved. */
/** Local festival dressing only. Campus transforms and daytime resources are preserved. */
export function createRouteArt(campus?: THREE.Object3D) {
  const group=new THREE.Group();group.name='entrance-route-art';
  const colliders:Collider[]=[];
  const hidden: {object:THREE.Object3D;visible:boolean}[]=[];
  const stone=new THREE.MeshStandardMaterial({color:0xbeb6a5,roughness:.92});
  const edge=new THREE.MeshStandardMaterial({color:0xd6c7a8,roughness:.82});
  const dark=new THREE.MeshStandardMaterial({color:0x222c31,roughness:.48,metalness:.68});
  const brass=new THREE.MeshStandardMaterial({color:0x987749,roughness:.48,metalness:.65});
  const timber=new THREE.MeshStandardMaterial({color:0x71503a,roughness:.86});
  const soil=new THREE.MeshStandardMaterial({color:0x32382e,roughness:1});
  const amber=new THREE.MeshBasicMaterial({color:0xffdc94,toneMapped:false});
  const cube=new RoundedBoxGeometry(1,1,1,2,.055);
  function box(name:string,x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material){const m=new THREE.Mesh(cube,mat);m.name=name;m.position.set(x,y,z);m.scale.set(w,h,d);group.add(m);return m;}
  function solid(x:number,z:number,w:number,d:number,label:string){colliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,label});}
  function rng(seed:number){let n=seed>>>0;return()=>{n=(1664525*n+1013904223)>>>0;return n/4294967296;};}
  const random=rng(2011);

  // Scanned CC0 pavers: local colour/normal/roughness, shared world scale at joins.
  const pavers=courtyardPavers();
  const entrancePavers=courtyardPavers(true);
  function surface(name:string,points:THREE.Vector3[],width:number,y:number,material:THREE.Material,widenEntry=false){
    const vertices:number[]=[],uv:number[]=[],indices:number[]=[];
    points.forEach((p,i)=>{const tangent=points[Math.min(i+1,points.length-1)].clone().sub(points[Math.max(0,i-1)]).normalize();const normal=new THREE.Vector3(-tangent.z,0,tangent.x);
      const apron=widenEntry?4.8*THREE.MathUtils.smoothstep(p.z,49,57):0;
      for(const side of [-1,1]){const q=p.clone().addScaledVector(normal,(width+apron)/2*side);vertices.push(q.x,y,q.z);uv.push(q.x/8,q.z/8);}
      if(i<points.length-1){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
    });const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,material);mesh.name=name;group.add(mesh);return mesh;
  }
  surface('festival-plaza-running-bond',[new THREE.Vector3(-72,0,8),new THREE.Vector3(72,0,8)],56,.231,pavers);
  // Short pedestrian threshold ends exactly at the square edge (x=72).
  // The fixed asphalt spine and its shared markings remain part of the campus.
  const v=(x:number,z:number)=>new THREE.Vector3(x,0,z);
  surface('festival-pedestrian-threshold',[v(80,29),v(72,29)],3.6,.249,entrancePavers);
  for(const z of [27.14,30.86])surface('pedestrian-threshold-border',[v(80,z),v(72,z)],.12,.251,stone);

  // Static ground light and contact shadows. No bloom or per-lantern PointLights.
  function radial(light:boolean){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d')!;const gradient=g.createRadialGradient(64,64,0,64,64,64);
    if(light){gradient.addColorStop(0,'rgba(255,209,126,.9)');gradient.addColorStop(.24,'rgba(255,179,74,.55)');gradient.addColorStop(.62,'rgba(235,142,51,.16)');gradient.addColorStop(1,'rgba(225,122,40,0)');}
    else{gradient.addColorStop(0,'rgba(12,18,27,.55)');gradient.addColorStop(.3,'rgba(12,18,27,.25)');gradient.addColorStop(1,'rgba(12,18,27,0)');}
    g.fillStyle=gradient;g.fillRect(0,0,128,128);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
  const poolMaterial=new THREE.MeshBasicMaterial({map:radial(true),transparent:true,opacity:.78,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  // Gate only: lower, wider wash. Keep the approved courtyard lighting unchanged.
  const gatePool=poolMaterial.clone();gatePool.opacity=.16;gatePool.blending=THREE.NormalBlending;
  const courtyardPool=poolMaterial.clone();courtyardPool.opacity=.44;courtyardPool.blending=THREE.NormalBlending;
  const shadowMaterial=new THREE.MeshBasicMaterial({map:radial(false),transparent:true,opacity:.65,depthWrite:false,toneMapped:false});
  const decalGeo=new THREE.PlaneGeometry(1,1);
  function decal(name:string,x:number,z:number,w:number,d:number,material:THREE.Material,y=.262){const m=new THREE.Mesh(decalGeo,material);m.name=name;m.rotation.x=-Math.PI/2;m.position.set(x,y,z);m.scale.set(w,d,1);m.renderOrder=2;group.add(m);return m;}
  // Keep poles on the approach edge; leave the board-to-garden court open.
  // Board lighting remains independent of these decorative route lamps.
  // Court lamps stand on the pale band between paving and the brick strip, 18 apart along the whole edge.
  const lampPositions=[[76,58],[92.2,57],[78,41.7],...[63,45,27,9,-9,-27,-45,-63].map(x=>[x,36.75] as const)] as const;
  function lantern(x:number,z:number){
    if(z>49){
      group.add(slenderGateLamp(x,z));
      // Preserve the existing lantern collision footprint exactly.
      solid(x,z,.72,.72,tr('Đèn mép lối'));decal('lantern-contact-shadow',x,z,1.8,1.8,shadowMaterial);
      return;
    }
    box('lantern-stone-foot',x,.38,z,.48,.24,.48,stone);
    box('route-lamp-stem',x,1.95,z,.095,3.15,.095,dark);
    box('route-lamp-crown',x,3.55,z,.43,.08,.43,brass);
    box('route-lamp-opal',x,3.8,z,.32,.48,.32,amber);
    for(const dx of [-.2,.2])for(const dz of [-.2,.2])box('lantern-frame',x+dx,3.8,z+dz,.035,.54,.035,dark);
    box('route-lamp-top',x,4.1,z,.58,.08,.58,dark);
    solid(x,z,.72,.72,tr('Đèn mép lối'));decal('lantern-contact-shadow',x,z,1.8,1.8,shadowMaterial);
    decal('warm-light-on-pavers',x+1.4,z,10,8.5,courtyardPool,.269);
  }
  lampPositions.forEach(([x,z])=>lantern(x,z));
  const plazaPool=courtyardPool.clone();plazaPool.opacity=.57;for(const x of [9,27])decal('plaza-evening-pool',x,36.75,9,7,plazaPool,.270);
  for(const x of [14.8,21.2])box('headquarters-canopy-light',x,3.74,-35.5,.58,.035,.2,amber);
  decal('headquarters-entry-light-spill',18,-33.8,10,1.6,courtyardPool,.174);
  group.add(createGateDressing());
  const gateAmber=new THREE.MeshBasicMaterial({color:0xc7ad7c,toneMapped:false});
  for(const x of [77,91]){
    box('gate-lamp-recess',x,1.65,55.42,.48,1.55,.065,dark);
    box('gate-lamp-brass-frame',x,1.65,55.47,.37,1.39,.07,brass);
    box('gate-lamp-opal-panel',x,1.65,55.515,.26,1.23,.025,gateAmber);
    const inward=x===77?1:-1;
    box('gate-inner-lamp-recess',x+inward*.62,1.65,54.8,.065,1.55,.48,dark);
    box('gate-inner-opal-panel',x+inward*.67,1.65,54.8,.025,1.23,.26,gateAmber);
    solid(x,54.8,1.5,1.5,tr('Chân trụ cổng'));decal('gate-pillar-contact',x,54.8,3,3,shadowMaterial);
    decal('gate-wall-lamp-ground-wash',x,56,9.5,9,gatePool,.271);
    decal('gate-inner-ground-wash',x+inward*2,55.5,9.5,9,gatePool,.272);
    // Two shared entry fill lights, not a dynamic light per path lantern.
    const fill=new THREE.PointLight(0xffdfad,6,17,2);fill.position.set(x+inward*.8,3.4,55.3);fill.name='entry-warm-fill';group.add(fill);
  }
  // The approved thin top bar lights the stele surface only; remove the old
  // overhead spotlight so it no longer spills onto the street or fence.
  const signWash=createSignWash(campus);group.add(signWash.group);
  // Clusters replace only the near-route repeated trees in festival presentation.
  const leafGeo=new THREE.IcosahedronGeometry(1,1);
  const leaves:{position:THREE.Vector3;scale:THREE.Vector3;color:THREE.Color}[]=[];
  function branch(a:THREE.Vector3,b:THREE.Vector3,r:number){const m=new THREE.Mesh(new THREE.CylinderGeometry(r*.6,r,a.distanceTo(b),8),timber);m.position.copy(a).lerp(b,.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());group.add(m);}
  function tree(x:number,z:number,h:number,r:number){
    branch(new THREE.Vector3(x,.25,z),new THREE.Vector3(x+.25,h*.92,z),.22);
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5+.3,tip=new THREE.Vector3(x+Math.cos(a)*r*.65,h*.9+(i%2)*.35,z+Math.sin(a)*r*.65);branch(new THREE.Vector3(x,h*.53,z),tip,.1);}
    // Offset irregular sprays around branch tips, leaving gaps between lobes.
    const turn=random()*Math.PI*2;
    const lobes=Array.from({length:7},(_,i)=>{
      const a=turn+i*Math.PI*2/7+(random()-.5)*.45,d=i===0?0:r*(.34+random()*.42);
      return {x:x+Math.cos(a)*d,z:z+Math.sin(a)*d,y:h+(random()-.46)*r*.74,spread:r*(.20+random()*.12)};
    });
    for(let i=0;i<90;i++){
      const l=lobes[i%lobes.length],a=random()*Math.PI*2,d=Math.sqrt(random())*l.spread;
      leaves.push({position:new THREE.Vector3(l.x+Math.cos(a)*d,l.y+(random()-.5)*l.spread,l.z+Math.sin(a)*d),scale:new THREE.Vector3(.36+random()*.53,.27+random()*.47,.36+random()*.53),color:new THREE.Color().setHSL(.22+random()*.075,.28+random()*.18,.17+random()*.14)});
    }
    solid(x,z,.6,.6,tr('Cây cụm lễ hội'));decal('tree-root-contact',x,z,3.5,3.5,shadowMaterial);
  }
  tree(71.8,51,7.1,3.5);tree(97,49,8.2,4);tree(99,36.5,5.9,2.7);
  tree(54,40.5,5.4,2.3);tree(65,42,4.2,1.5);tree(68,10,4.8,1.8);
  // Mirror of the (99,36.5) tree about the multipurpose hall axis x=112; last so earlier crowns keep their random shapes.
  tree(125,36.5,5.9,2.7);
  // Layered alpha-cut leaf sprays give a readable leaf silhouette at eye level.
  const canopyCanvas=document.createElement('canvas');canopyCanvas.width=canopyCanvas.height=256;const canopyCtx=canopyCanvas.getContext('2d')!;
  for(let i=0;i<45;i++){
    const a=random()*Math.PI*2,r=Math.sqrt(random())*88,x=128+Math.cos(a)*r,y=128+Math.sin(a)*r;
    canopyCtx.save();canopyCtx.translate(x,y);canopyCtx.rotate(a);canopyCtx.beginPath();canopyCtx.ellipse(0,0,9+random()*6,16+random()*10,0,0,Math.PI*2);canopyCtx.fillStyle=random()>.4?'#f0f3df':'#cbd7bb';canopyCtx.fill();canopyCtx.strokeStyle='#8c9c73';canopyCtx.lineWidth=1;canopyCtx.beginPath();canopyCtx.moveTo(0,-15);canopyCtx.lineTo(0,15);canopyCtx.stroke();canopyCtx.restore();
  }
  const canopyMap=new THREE.CanvasTexture(canopyCanvas);canopyMap.colorSpace=THREE.SRGBColorSpace;
  const sprays=[new THREE.PlaneGeometry(2.5,2.5),new THREE.PlaneGeometry(2.5,2.5).rotateY(Math.PI/2),new THREE.PlaneGeometry(2.5,2.5).rotateX(-Math.PI/2)];
  const canopyGeo=mergeGeometries(sprays)!;sprays.forEach(g=>g.dispose());
  const canopyMat=new THREE.MeshStandardMaterial({map:canopyMap,alphaTest:.45,side:THREE.DoubleSide,roughness:.95});
  const foliage=new THREE.InstancedMesh(canopyGeo,canopyMat,leaves.length),stamp=new THREE.Object3D();foliage.name='clustered-route-canopies';
  leaves.forEach((leaf,i)=>{stamp.position.copy(leaf.position);stamp.scale.copy(leaf.scale);stamp.rotation.set(random(),random()*Math.PI,random());stamp.updateMatrix();foliage.setMatrixAt(i,stamp.matrix);foliage.setColorAt(i,leaf.color);});group.add(foliage);
  const flowerSpecs:{x:number;y:number;z:number;color:number;size:number;angle:number}[]=[];
  const flowerColors=[0xda7755,0xcd6951,0xb65349,0xf1c675,0xe9af58];
  function planter(x:number,z:number,w:number,d:number){
    const lowGateGarden=x===96.5&&z===57;
    if(lowGateGarden){
      // Restore this old right-side flower plot as a low grass bed, not a raised
      // wall in front of the fence. Keep its existing XZ collision reservation.
      box('gate-garden-original-plot-soil',x,.1,z,w-.15,.12,d-.35,soil);
    }else{
      box('planter-stone-body',x,.57,z,w,.64,d,stone);box('planter-soil',x,.91,z,w-.3,.06,d-.3,soil);
      for(const side of [-1,1]){box('planter-top-rim',x,.94,z+side*(d/2-.08),w+.1,.13,.18,edge);box('planter-top-rim',x+side*(w/2-.08),.94,z,.18,.13,d+.1,edge);}
    }
    const clumps=Math.max(3,Math.round(w*1.4)), reach=Math.min(.48,d*.22);
    for(let j=0;j<clumps;j++){
      const cx=x+((j+.5+(random()-.5)*.72)/clumps-.5)*(w-.78),cz=z+(random()-.5)*(d-.92);
      const hue=Math.floor(random()*flowerColors.length),count=4+Math.floor(random()*7);
      for(let i=0;i<count;i++){
        const a=random()*Math.PI*2, r=Math.sqrt(random())*reach;
        const px=THREE.MathUtils.clamp(cx+Math.cos(a)*r,x-w/2+.27,x+w/2-.27);
        const pz=THREE.MathUtils.clamp(cz+Math.sin(a)*r,z-d/2+.27,z+d/2-.27);
        flowerSpecs.push({x:px,y:(lowGateGarden?.32:1.035)+random()*.24,z:pz,color:flowerColors[random()<.85?hue:(hue+1)%flowerColors.length],size:.63+random()*.64,angle:random()*Math.PI*2});
      }
    }
    solid(x,z,w,d,tr('Bồn hoa mép lối'));decal('planter-soft-contact',x,z,w+1.2,d+1.2,shadowMaterial);
  }
  planter(71.5,58.5,3.2,2.3);planter(96.5,57,4.1,2.2);planter(58,37.2,7,2.2);planter(37,32,3.8,2.2);planter(55,32,3.8,2.2);
  const blooms=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.13,1),new THREE.MeshStandardMaterial({roughness:.9}),flowerSpecs.length*4);
  flowerSpecs.forEach((f,i)=>{
    for(let petal=0;petal<4;petal++){
      const a=f.angle+petal*Math.PI/2;
      stamp.position.set(f.x+Math.cos(a)*.09*f.size,f.y,f.z+Math.sin(a)*.09*f.size);
      stamp.scale.set(f.size,.47*f.size,.82*f.size);stamp.rotation.set(.12,-a,.14);
      stamp.updateMatrix();blooms.setMatrixAt(i*4+petal,stamp.matrix);blooms.setColorAt(i*4+petal,new THREE.Color(f.color));
    }
  });blooms.name='clustered-planter-flowers';group.add(blooms);
  const flowerLeaves=new THREE.InstancedMesh(leafGeo,new THREE.MeshStandardMaterial({color:0x45683a,roughness:1}),flowerSpecs.length*2);
  flowerSpecs.forEach((f,i)=>{
    for(let k=0;k<2;k++){
      const a=f.angle+k*Math.PI*.8;
      const base=f.y<.8?.3:1.03;
      stamp.position.set(f.x+Math.cos(a)*.12,base+(f.y-base)*.25,f.z+Math.sin(a)*.12);
      stamp.scale.set(.24*f.size,.09*f.size,.115*f.size);stamp.rotation.set(0,-a,k===0?.26:-.26);
      stamp.updateMatrix();flowerLeaves.setMatrixAt(i*2+k,stamp.matrix);
    }
  });group.add(flowerLeaves);
  function bench(x:number,z:number){
    const start=group.children.length;
    for(const dx of [-1.7,1.7]){box('bench-cast-foot',x+dx,.52,z,.16,.6,1.35,dark);box('bench-side-arm',x+dx,1.1,z,.1,.14,1.35,dark);}
    for(let i=0;i<5;i++)box('bench-seat-slat',x,.85,z-.5+i*.25,4.4,.14,.2,timber);
    for(let i=0;i<3;i++)box('bench-back-slat',x,1.18+i*.24,z-.64,4.4,.18,.13,timber);
    decal('bench-contact',x,z,5.4,2.7,shadowMaterial);
    const chair=new THREE.Group();chair.name='bench-facing-flower-garden';chair.position.set(x,0,z);
    // Align the long bench edge with the straight approach road (east–west).
    // The back faces the road; the seat faces into the courtyard and garden.
    const yaw=Math.PI;chair.rotation.y=yaw;chair.userData.front=[0,-1];
    for(const child of group.children.slice(start)){child.position.x-=x;child.position.z-=z;chair.add(child);}
    group.add(chair);
    solid(x,z,4.8*Math.abs(Math.cos(yaw))+1.5*Math.abs(Math.sin(yaw)),4.8*Math.abs(Math.sin(yaw))+1.5*Math.abs(Math.cos(yaw)),tr('Ghế mép lối'));
  }
  // A single furniture band frames the garden; the central court stays open.
  bench(28,32);bench(46,32);bench(64,32);
  decal('board-foot-contact',0,8,18,2.4,shadowMaterial);decal('board-reading-pool',0,13,20,12,courtyardPool,.27);
  decal('guard-window-soft-spill',71.5,41,10,7,courtyardPool,.268);

  if(campus)campus.traverse(o=>{
    if(o instanceof THREE.LineSegments && o.geometry.attributes.position.count===136){hidden.push({object:o,visible:o.visible});}
    if(o instanceof THREE.Mesh){
      const near=o.position.x>=40&&o.position.x<=80&&o.position.z>=0&&o.position.z<=42;
      if(near&&(o.userData.campusTree||['IcosahedronGeometry','CylinderGeometry'].includes(o.geometry.type)))hidden.push({object:o,visible:o.visible});
    }
  });
  return {group,colliders,replacesCollider(c:Collider){const x=(c.minX+c.maxX)/2,z=(c.minZ+c.maxZ)/2;return c.label==='Cây'&&x>=40&&x<=80&&z>=0&&z<=42;},setEnabled(enabled:boolean){for(const item of hidden)item.object.visible=enabled?false:item.visible;signWash.setEnabled(enabled);}};
}
