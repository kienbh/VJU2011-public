import * as THREE from 'three';

type Surface = 'grass' | 'asphalt' | 'pavers';
const assets = {grass:'leafy_grass',asphalt:'asphalt_02',pavers:'pavement_03'} as const;
const textures = new Map<string, THREE.Texture>();
let surfaceAnisotropy=8;
export function setSurfaceAnisotropy(value:number){surfaceAnisotropy=value;for(const map of textures.values()){if(map.anisotropy!==value){map.anisotropy=value;map.needsUpdate=true;}}}
function texture(asset:string,kind:string) {
  const key=`${asset}-${kind}`;
  if(!textures.has(key)) {
    const map=new THREE.TextureLoader().load(`/assets/polyhaven/${key}.webp`);
    map.name=key;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=surfaceAnisotropy;
    if(kind==='color')map.colorSpace=THREE.SRGBColorSpace;
    textures.set(key,map);
  }
  return textures.get(key)!;
}

/** Locally hosted CC0 surfaces; world-space mapping keeps adjoining road pieces
 * continuous, including curved junctions without UVs. No displacement/collider changes. */
export function createSurfaceMaterial(kind:Surface, color=0xffffff) {
  const asset=assets[kind],size=kind==='grass'?6:kind==='asphalt'?5:4;
  const material=new THREE.MeshStandardMaterial({
    color,map:texture(asset,'color'),normalMap:texture(asset,'normal'),
    roughnessMap:texture(asset,'roughness'),roughness:kind==='grass'?1:.94,
    normalScale:new THREE.Vector2(kind==='grass'?.4:kind==='asphalt'?.22:.32,kind==='grass'?.4:kind==='asphalt'?.22:.32),
  });
  material.name=`surface-${kind}`;
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 vSurfaceWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
      vSurfaceWorld=(modelMatrix*vec4(position,1.0)).xz;
      vec2 surfaceUv=vSurfaceWorld/${size.toFixed(1)};
      #ifdef USE_MAP
        vMapUv=surfaceUv;
      #endif
      #ifdef USE_NORMALMAP
        vNormalMapUv=surfaceUv;
      #endif
      #ifdef USE_ROUGHNESSMAP
        vRoughnessMapUv=surfaceUv;
      #endif`);
    shader.fragmentShader='varying vec2 vSurfaceWorld;\n'+shader.fragmentShader;
    // Broad, low-contrast variation breaks the wallpaper effect at flycam distance.
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      ${kind==='pavers'?'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.30,0.28,0.25)*diffuse,0.12);':''}
      ${kind==='asphalt'?'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.12,0.135,0.145)*diffuse,0.40);':''}
      float macroVariation=sin(vSurfaceWorld.x*.071+sin(vSurfaceWorld.y*.11))*cos(vSurfaceWorld.y*.047);
      diffuseColor.rgb*=1.0+macroVariation*${kind==='grass'?'0.13':'0.045'};`);
  };
  material.customProgramCacheKey=()=>`vju-surface-v3-${kind}`;
  return material;
}
