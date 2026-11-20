import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Small, static detail batches. All decoration stays inside each approved plot. */
export function detailBatch(name: string) {
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const add = (material: THREE.Material, x:number,y:number,z:number,w:number,h:number,d:number,r=.025) => {
    const source = r > 0 ? new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/5,h/5,d/5)) : new THREE.BoxGeometry(w,h,d);
    const geometry=source.index?source.toNonIndexed():source;
    if(geometry!==source)source.dispose();
    geometry.translate(x,y,z);
    if (!batches.has(material)) batches.set(material,[]);
    batches.get(material)!.push(geometry);
  };
  const finish = () => {
    const group=new THREE.Group();group.name=name;
    for(const [material,geometries] of batches){
      const merged=mergeGeometries(geometries,false)!;
      const mesh=new THREE.Mesh(merged,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
      geometries.forEach(g=>g.dispose());
    }
    return group;
  };
  return {add,finish};
}

let plasterBump:THREE.CanvasTexture|undefined;
export function districtPlaster(color:number) {
  if(!plasterBump){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d')!,data=ctx.createImageData(128,128);let seed=73;
    for(let i=0;i<data.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const g=117+(seed%22);data.data.set([g,g,g,255],i);}
    ctx.putImageData(data,0,0);plasterBump=new THREE.CanvasTexture(canvas);plasterBump.wrapS=plasterBump.wrapT=THREE.RepeatWrapping;plasterBump.repeat.set(4,3);
  }
  const m=new THREE.MeshStandardMaterial({color,roughness:.87,bumpMap:plasterBump,bumpScale:.025});
  m.onBeforeCompile=s=>{s.vertexShader='varying vec3 plasterWorld;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
  vec4 pp=vec4(transformed,1.);
  #ifdef USE_INSTANCING
  pp=instanceMatrix*pp;
  #endif
  plasterWorld=(modelMatrix*pp).xyz;`);s.fragmentShader='varying vec3 plasterWorld;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
  float pv=sin(plasterWorld.x*3.1+sin(plasterWorld.z*2.3))*cos(plasterWorld.y*2.7+plasterWorld.z*1.3);roughnessFactor=clamp(roughnessFactor+pv*.035,0.,1.);`);};m.customProgramCacheKey=()=> 'district-plaster-pbr-v1';return m;
}

/** Static ripples: no animation, full-scene bloom or expensive reflection pass. */
export function districtWaterMaterial() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d')!,data=ctx.createImageData(256,256);
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const nx=x/256*Math.PI*2,ny=y/256*Math.PI*2;
    const v=Math.round(128+13*Math.sin(nx*2+Math.sin(ny))+5*Math.cos(ny*6+nx));
    const i=(y*256+x)*4;data.data.set([v,v,v,255],i);
  }
  ctx.putImageData(data,0,0);
  const bump=new THREE.CanvasTexture(canvas);bump.wrapS=bump.wrapT=THREE.RepeatWrapping;
  const faces=Array.from({length:6},()=>{
    const c=document.createElement('canvas');c.width=c.height=64;const cctx=c.getContext('2d')!;
    const gradient=cctx.createLinearGradient(0,0,0,64);gradient.addColorStop(0,'#a9c1cd');gradient.addColorStop(.55,'#91a9ac');gradient.addColorStop(.74,'#486957');gradient.addColorStop(1,'#374d42');cctx.fillStyle=gradient;cctx.fillRect(0,0,64,64);return c;
  });
  const environment=new THREE.CubeTexture(faces as unknown as HTMLImageElement[]);environment.colorSpace=THREE.SRGBColorSpace;environment.needsUpdate=true;
  const material=new THREE.MeshPhysicalMaterial({color:0x668480,roughness:.3,metalness:.05,bumpMap:bump,bumpScale:.065,clearcoat:.45,clearcoatRoughness:.35,envMap:environment,envMapIntensity:.6});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vLakeWorld;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvLakeWorld=(modelMatrix*vec4(position,1.)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vLakeWorld;')
      .replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\n')
      .replace('#include <color_fragment>','#include <color_fragment>\nfloat ripple = sin(vLakeWorld.x*.32+sin(vLakeWorld.z*.19)); diffuseColor.rgb *= .995+.008*ripple;');
    // ShapeGeometry UV is in model units: keep ripples at world scale.
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvBumpMapUv=(modelMatrix*vec4(position,1.)).xz*.12;');
  };
  material.customProgramCacheKey=()=> 'district-water-static-v1';
  return material;
}
