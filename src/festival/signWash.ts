import * as THREE from 'three';

/** Local surface irradiance from a concealed linear fixture. No scene lights,
 * projection outside the stele, photo texture, emission or postprocessing. */
export function createSignWash(campus?:THREE.Object3D){
  const group=new THREE.Group();group.name='gate-sign-wash';group.visible=false;
  const stone=campus?.getObjectByName('vju-gate-dark-nameplate');
  const inscription=campus?.getObjectByName('gate-stone-inscription');
  const swaps:{mesh:THREE.Mesh;original:THREE.MeshStandardMaterial;lit:THREE.MeshStandardMaterial}[]=[];
  if(stone instanceof THREE.Mesh&&inscription instanceof THREE.Mesh){
    const bounds=new THREE.Box3().setFromObject(stone),width=bounds.max.x-bounds.min.x;
    const x=(bounds.min.x+bounds.max.x)/2,top=bounds.max.y,front=bounds.max.z;
    const bar=new THREE.Mesh(new THREE.BoxGeometry(width+.06,.075,.22),new THREE.MeshStandardMaterial({color:0x121719,roughness:.6,metalness:.45}));
    bar.name='gate-sign-black-light-bar';bar.position.set(x,top+.0275,front+.065);group.add(bar);
    // Recess the warm diffuser under the black lip: no bright forward-facing strip.
    const diffuser=new THREE.Mesh(new THREE.PlaneGeometry(width-.22,.055),new THREE.MeshBasicMaterial({color:0xb49b70,toneMapped:false}));
    diffuser.name='gate-sign-recessed-diffuser';diffuser.rotation.x=Math.PI/2;diffuser.position.set(x,top-.011,front+.08);group.add(diffuser);
    for(const mesh of [stone,inscription]){
      if(!(mesh.material instanceof THREE.MeshStandardMaterial))continue;
      const original=mesh.material,lit=original.clone();
      mesh.geometry.computeBoundingBox();const local=mesh.geometry.boundingBox!;
      const origin=new THREE.Vector2(local.min.x,local.min.y),size=new THREE.Vector2(local.max.x-local.min.x,local.max.y-local.min.y);
      const key=original.customProgramCacheKey(),compile=original.onBeforeCompile;
      lit.customProgramCacheKey=()=>key+'|vju-stele-surface-wash-v1';
      lit.onBeforeCompile=(shader,renderer)=>{
        compile.call(lit,shader,renderer);
        shader.uniforms.biaOrigin={value:origin};shader.uniforms.biaSize={value:size};
        shader.uniforms.biaWarm={value:new THREE.Color(0xffc27d)};
        // Dark stone needs a broader reflection lift than the bright painted
        // lettering. Keep the latter restrained to preserve its red colour.
        shader.uniforms.biaStrength={value:mesh===stone?18:6};
        shader.vertexShader='varying vec3 vBiaLocalPosition; varying vec3 vBiaLocalNormal;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vBiaLocalPosition=position; vBiaLocalNormal=normal;');
        shader.fragmentShader='varying vec3 vBiaLocalPosition; varying vec3 vBiaLocalNormal; uniform vec2 biaOrigin; uniform vec2 biaSize; uniform vec3 biaWarm; uniform float biaStrength;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
          vec2 biaUV=(vBiaLocalPosition.xy-biaOrigin)/biaSize;
          float biaFront=step(0.9,vBiaLocalNormal.z);
          // Broad upper wash, gently rolled off at the fixture instead of a hotspot.
          // The title around y=.54 remains inside the evenly illuminated area.
          float biaVertical=smoothstep(0.04,0.86,biaUV.y)*(1.0-0.12*smoothstep(0.88,1.0,biaUV.y));
          float biaEdge=mix(0.74,1.0,smoothstep(0.0,0.18,biaUV.x)*smoothstep(0.0,0.18,1.0-biaUV.x));
          reflectedLight.directDiffuse += BRDF_Lambert(diffuseColor.rgb) * biaWarm * (biaStrength*biaFront*biaVertical*biaEdge);
        `);
      };
      lit.userData={...lit.userData,gateSignSurfaceWash:true};
      swaps.push({mesh,original,lit});
    }
  }
  return {group,setEnabled(enabled:boolean){group.visible=enabled;for(const s of swaps)s.mesh.material=enabled?s.lit:s.original;}};
}
