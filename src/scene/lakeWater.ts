import * as THREE from 'three';
import {Water} from 'three/addons/objects/Water.js';
import {phoneScreen} from '../mobile';

let normals:THREE.DataTexture|undefined,reflecting=false;
let qualityReflections=true,qualityInterval=0;
export function setLakeQuality(reflections:boolean,interval:number){qualityReflections=reflections;qualityInterval=interval;}
function rippleNormals(){
  if(normals)return normals;
  const size=256,data=new Uint8Array(size*size*4);
  const hash=(x:number,y:number)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
  const noise=(x:number,y:number,cells:number)=>{
    const u=(x+size)%size/size*cells,v=(y+size)%size/size*cells,ix=Math.floor(u),iy=Math.floor(v);
    let fx=u-ix,fy=v-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix%cells,iy%cells),hash((ix+1)%cells,iy%cells),fx),THREE.MathUtils.lerp(hash(ix%cells,(iy+1)%cells),hash((ix+1)%cells,(iy+1)%cells),fx),fy);
  };
  const height=(x:number,y:number)=>noise(x,y,12)+.45*noise(x,y,28)+.2*noise(x,y,56);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const nx=(height(x+1,y)-height(x-1,y))*.75,ny=(height(x,y+1)-height(x,y-1))*.75;
    const n=new THREE.Vector3(nx,ny,1).normalize(),i=(y*size+x)*4;
    data.set([Math.round((n.x*.5+.5)*255),Math.round((n.y*.5+.5)*255),Math.round((n.z*.5+.5)*255),255],i);
  }
  normals=new THREE.DataTexture(data,size,size);normals.wrapS=normals.wrapT=THREE.RepeatWrapping;
  normals.magFilter=THREE.LinearFilter;normals.minFilter=THREE.LinearMipmapLinearFilter;normals.generateMipmaps=true;normals.needsUpdate=true;
  return normals;
}

/** Real planar reflections of the campus; no prepainted fake building silhouettes. */
export function createLakeWater(geometry:THREE.BufferGeometry){
  const resolution=phoneScreen.matches?256:512;
  const water=new Water(geometry,{textureWidth:resolution,textureHeight:resolution,waterNormals:rippleNormals(),
    waterColor:0x238b99,sunColor:0xf1faff,sunDirection:new THREE.Vector3(-.4,.8,.3).normalize(),
    distortionScale:.65,alpha:1,fog:true});
  water.material.uniforms.size.value=7;
  // Fresh water has a lower normal-incidence reflectance than the addon's stylised default.
  water.material.fragmentShader=water.material.fragmentShader
    .replace('float rf0 = 0.3;','float rf0 = 0.025;')
    .replace('rf0 + ( 1.0 - rf0 ) * pow( ( 1.0 - theta ), 5.0 )','rf0 + 0.58 * pow( ( 1.0 - theta ), 5.0 )')
    .replace('max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor','mix(0.5, 1.0, theta) * waterColor')
    // Keep the reflected campus, but remove the grey additive veil and harsh sparkle.
    .replace('vec3( 0.1 ) + reflectionSample * 0.9 + reflectionSample * specularLight','reflectionSample * 0.85 + reflectionSample * specularLight * 0.35')
    .replace('sunColor * diffuseLight * 0.3 + scatter','sunColor * diffuseLight * 0.08 + scatter');
  // The low-cost mode keeps sky colour, ripple normals and a sun highlight, never a flat grey mirror.
  water.material.uniforms.qualitySky={value:0};
  water.material.fragmentShader='uniform float qualitySky;\n'+water.material.fragmentShader;
  water.material.fragmentShader=water.material.fragmentShader.replace('float reflectance =',`reflectionSample = mix(reflectionSample,
    mix(vec3(0.25,0.40,0.52),vec3(0.72,0.80,0.83),pow(clamp(theta,0.0,1.0),0.65))
    + vec3(0.9,0.78,0.5)*pow(clamp(dot(reflect(-eyeDirection,surfaceNormal),sunDirection),0.0,1.0),64.0)*0.25,qualitySky);
    float reflectance =`);
  const reflect=water.onBeforeRender;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let last=performance.now(),lastReflection=-1000;
  const lastCamera=new THREE.Vector3(Infinity,Infinity,Infinity),lastRotation=new THREE.Quaternion();
  water.onBeforeRender=function(...args){
    if(reflecting)return;
    const now=performance.now(),camera=args[2],dt=Math.min((now-last)/1000,.1);last=now;
    if(!reduced.matches&&!document.body.classList.contains('reduced-motion')&&!document.hidden)water.material.uniforms.time.value+=dt*.18;
    water.material.uniforms.qualitySky.value=qualityReflections?0:1;
    camera.getWorldPosition(water.material.uniforms.eye.value);
    if(!qualityReflections)return;
    // Reflections refresh when moving; while still, cap this extra scene pass at 12 Hz.
    const moved=lastCamera.distanceToSquared(camera.position)>.04||1-Math.abs(lastRotation.dot(camera.quaternion))>.00001;
    if(now-lastReflection<Math.max(qualityInterval,phoneScreen.matches?125:moved?0:83))return;
    reflecting=true;
    try{reflect.apply(this,args);lastReflection=now;lastCamera.copy(camera.position);lastRotation.copy(camera.quaternion);}
    finally{reflecting=false;}
  };
  water.userData.reflectiveLake=true;
  return water;
}

/** Meshy is optional at runtime; missing local asset never prevents entering the campus. */
export function loadLakeshoreAsset(parent:THREE.Group,positions:THREE.Vector3[]){
  if(!import.meta.env.DEV||import.meta.env.VITE_LOCAL_MESHY_REVIEW!=='1'){parent.userData.lakeshoreAsset='fallback';return;}
  parent.userData.lakeshoreAsset='loading';
  void import('three/addons/loaders/GLTFLoader.js').then(async({GLTFLoader})=>{
    const {scene}=await new GLTFLoader().loadAsync('/assets/festival/lakeshore-meshy.glb');
    const bounds=new THREE.Box3().setFromObject(scene),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    const scale=3.8/Math.max(size.x,size.z);if(!Number.isFinite(scale))throw Error('Invalid lakeshore model');
    positions.forEach((position,i)=>{
      const anchor=new THREE.Group();anchor.name='meshy-lakeshore-rocks-and-reeds';anchor.position.copy(position);anchor.rotation.y=i*2.399;
      const model=scene.clone(true);model.scale.setScalar(scale*(.8+(i%3)*.12));
      model.position.set(-center.x*model.scale.x,-bounds.min.y*model.scale.y,-center.z*model.scale.z);anchor.add(model);parent.add(anchor);
    });parent.userData.lakeshoreAsset='loaded';
  }).catch(()=>{parent.userData.lakeshoreAsset='fallback';});
}
