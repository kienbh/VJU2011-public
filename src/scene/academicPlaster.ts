import * as T from 'three';
let maps:{color:T.Texture;normal:T.Texture;roughness:T.Texture}|undefined;
export function applyAcademicPlaster(material:T.MeshStandardMaterial){
 if(!maps){const load=(kind:string)=>{const t=new T.TextureLoader().load('/assets/polyhaven/painted_plaster_wall-'+kind+'.webp');t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;if(kind==='color')t.colorSpace=T.SRGBColorSpace;return t;};maps={color:load('color'),normal:load('normal'),roughness:load('roughness')};}
 material.map=maps.color;material.normalMap=maps.normal;material.roughnessMap=maps.roughness;material.bumpMap=null;material.normalScale.set(.35,.35);
 material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
 vec3 axis=abs(normal);vec2 plasterUv=(axis.y>axis.x&&axis.y>axis.z?position.xz:(axis.x>axis.z?position.zy:position.xy))*.5;
 vMapUv=plasterUv;vNormalMapUv=plasterUv;vRoughnessMapUv=plasterUv;`);shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','diffuseColor.rgb *= mix(vec3(1.0),texture2D(map,vMapUv).rgb,.18);');};material.customProgramCacheKey=()=> 'academic-plaster-v3';
}
