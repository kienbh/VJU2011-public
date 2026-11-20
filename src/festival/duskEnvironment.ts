import * as THREE from 'three';

/** Generated reflection gradient; blended only for the optional dusk presentation. */
export function createDuskEnvironment(scene:THREE.Scene){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
  const ctx=canvas.getContext('2d')!,gradient=ctx.createLinearGradient(0,0,0,128);
  for(const [stop,color] of [[0,'#263e60'],[.49,'#9aa6ba'],[.51,'#535f6c'],[1,'#222b36']] as const)gradient.addColorStop(stop,color);
  ctx.fillStyle=gradient;ctx.fillRect(0,0,256,128);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.mapping=THREE.EquirectangularReflectionMapping;
  scene.environment=texture;scene.environmentIntensity=0;
  const waters:THREE.ShaderMaterial[]=[];scene.traverse(o=>{if(o instanceof THREE.Mesh&&o.userData.reflectiveLake)waters.push(o.material as THREE.ShaderMaterial);});
  const waterDay=new THREE.Color(0x245b56),waterDusk=new THREE.Color(0x18394b),sunDay=new THREE.Color(0xffedce),sunDusk=new THREE.Color(0x627ca1);
  return (dusk:number,night:number)=>{
    scene.environmentIntensity=THREE.MathUtils.lerp(.55*dusk,.2,night);
    const blend=Math.max(dusk,night);
    for(const m of waters){m.uniforms.waterColor.value.copy(waterDay).lerp(waterDusk,blend);m.uniforms.sunColor.value.copy(sunDay).lerp(sunDusk,blend);}
  };
}
