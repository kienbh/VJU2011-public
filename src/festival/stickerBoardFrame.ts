import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Double-sided ceremonial frame; repeated ornaments share one draw call per finish. */
export function createStickerBoardFrame(){
  const group=new THREE.Group();group.name='ceremonial-board-frame';
  const materials={
    lacquer:new THREE.MeshStandardMaterial({color:0x701c32,roughness:.42,metalness:.12}),
    dark:new THREE.MeshStandardMaterial({color:0x351320,roughness:.56}),
    gold:new THREE.MeshStandardMaterial({color:0xe9b94e,roughness:.32,metalness:.48,emissive:0x805318,emissiveIntensity:.15}),
    ivory:new THREE.MeshStandardMaterial({color:0xf4dfb4,roughness:.5,metalness:.1}),
    glow:new THREE.MeshBasicMaterial({color:0xffe7ac,toneMapped:false}),
  };
  type Finish=keyof typeof materials;
  const batches:Record<Finish,THREE.BufferGeometry[]>={lacquer:[],dark:[],gold:[],ivory:[],glow:[]};
  function add(geometry:THREE.BufferGeometry,finish:Finish,x:number,y:number,z:number,rotation=0){
    // The primitives have differing index/UV layouts; unify before merging.
    const g=geometry.index?geometry.toNonIndexed():geometry.clone();geometry.dispose();
    g.deleteAttribute('uv');g.rotateZ(rotation);g.translate(x,y,z);batches[finish].push(g);
  }
  function box(x:number,y:number,z:number,w:number,h:number,d:number,finish:Finish){add(new RoundedBoxGeometry(w,h,d,2,.025),finish,x,y,z);}
  box(0,6.75,0,28.7,11.3,.44,'dark');
  for(const x of [-14.08,14.08]){
    box(x,6.45,0,.72,12.3,.84,'lacquer');
    box(x,.35,0,.84,.5,1.14,'dark');box(x,.65,0,.8,.14,1.04,'gold');
    box(x,1.12,0,.71,.75,.86,'lacquer');box(x,1.48,0,.78,.12,.98,'gold');
    box(x,12.15,0,.8,.35,1.02,'gold');
  }
  box(0,1.33,0,28.7,.32,.7,'lacquer');
  box(0,12.32,0,28.9,.42,.88,'lacquer');
  box(0,12.58,0,29,.13,1,'gold');box(0,12.7,0,28.7,.12,.85,'dark');
  for(const side of [1,-1]){
    const z=side*.46;
    for(const x of [-14.08,14.08]){
      for(const dx of [-.25,.25])box(x+dx,6.7,z,.055,10.6,.045,'gold');
      box(x,6.7,z,.065,8.9,.055,'gold');
      for(const y of [2,11.45])add(new THREE.OctahedronGeometry(.19),'gold',x,y,z+side*.05);
    }
    for(const y of [1.47,12.09])box(0,y,side*.48,27.65,.065,.055,'gold');
    box(0,12.48,side*.51,27.7,.035,.035,'glow');
    box(0,1.16,side*.4,27.7,.05,.045,'gold');
    // Corner palmettes stay outside the sticker area.
    for(const x of [-13.48,13.48])for(const y of [1.86,11.7]){
      for(let i=0;i<5;i++){
        const angle=(i-2)*.5, petal=new THREE.SphereGeometry(1,10,6);
        petal.scale(.055,.25,.035);add(petal,'gold',x+Math.sin(angle)*.14,y+Math.cos(angle)*.1,side*.5,-angle);
      }
    }
    // Raised central crest: an open book beneath a symmetrical lotus.
    box(0,12.62,0,4.3,.18,.85,'gold');
    const medallion=new THREE.SphereGeometry(1,28,12);medallion.scale(.8,.69,.16);
    add(medallion,'lacquer',0,13.07,side*.25);
    const ring=new THREE.TorusGeometry(.63,.035,6,40);add(ring,'gold',0,13.07,side*.43);
    for(let i=-2;i<=2;i++){
      const petal=new THREE.SphereGeometry(1,12,8);petal.scale(.095,.28,.045);
      add(petal,'gold',i*.15,13.18-Math.abs(i)*.07,side*.47,-i*.42);
    }
    for(const direction of [-1,1]){
      const page=new RoundedBoxGeometry(.36,.17,.06,2,.015);add(page,'ivory',direction*.19,12.79,side*.48,direction*.13);
      for(let i=0;i<7;i++){
        const leaf=new THREE.SphereGeometry(1,8,6);leaf.scale(.24,.065,.035);
        add(leaf,'gold',direction*(.9+i*.23),12.94-i*.032,side*.39,direction*(.35+i*.06));
      }
    }
  }
  for(const finish of Object.keys(batches) as Finish[]){
    const geometry=mergeGeometries(batches[finish]);
    if(geometry){const mesh=new THREE.Mesh(geometry,materials[finish]);mesh.name=`board-frame-${finish}`;group.add(mesh);}
    batches[finish].forEach(g=>g.dispose());
  }
  return group;
}

