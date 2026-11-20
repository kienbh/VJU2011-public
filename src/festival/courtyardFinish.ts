import { createSurfaceMaterial } from '../scene/surfaceMaterials';

/** Quieter mineral paving in the courtyard; approved gate surfaces stay unchanged. */
export function courtyardPavers(route=false) {
  const material=createSurfaceMaterial('pavers',route?0xffe7c4:0xe7e3df);
  const compile=material.onBeforeCompile;
  material.onBeforeCompile=(shader,renderer)=>{
    compile.call(material,shader,renderer);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float courtyardFinish=${route?'1.0-smoothstep(42.0,48.0,vSurfaceWorld.y)':'1.0'};
      diffuseColor.rgb=mix(diffuseColor.rgb,
        mix(vec3(${route?'0.43,0.355,0.265':'0.395,0.38,0.35'}),diffuseColor.rgb,0.70),courtyardFinish);
    `);
  };
  material.customProgramCacheKey=()=>`vju-courtyard-finish-${route?'route':'square'}-v2`;
  material.name=route?'courtyard-route-pavers':'courtyard-mineral-pavers';
  return material;
}
