import * as THREE from 'three';
/** Reuses existing window geometry and restores the exact day materials on exit. */
export function createWindowLights(campus:THREE.Object3D){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d')!;
  const g=ctx.createLinearGradient(0,0,0,128);g.addColorStop(0,'#fff2cb');g.addColorStop(.25,'#eedab0');g.addColorStop(1,'#795e40');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
  ctx.fillStyle='#fff8e6';ctx.fillRect(18,9,92,5);
  ctx.fillStyle='#3a454b66';ctx.fillRect(0,92,128,36);ctx.fillRect(14,82,38,7);ctx.fillRect(79,77,29,8);
  ctx.fillStyle='#a79b8144';for(const x of [0,7,118,125])ctx.fillRect(x,0,3,128);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const saved=new Map<THREE.MeshStandardMaterial,{emissive:THREE.Color;intensity:number;map:THREE.Texture|null}>();
  campus.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      if(!(material instanceof THREE.MeshStandardMaterial)||!/(glazing|curtain-dark|campus-window-glass|dom-window-glass)/.test(material.name)||saved.has(material))continue;
      saved.set(material,{emissive:material.emissive.clone(),intensity:material.emissiveIntensity,map:material.emissiveMap});
    }
  });
  return {count:saved.size,setEnabled(enabled:boolean){for(const [material,base] of saved){
    material.emissive.copy(enabled?new THREE.Color('#ffe2ac'):base.emissive);
    material.emissiveIntensity=enabled?(material.name.includes('variation')?.8:material.name.includes('curtain')?.32:.57):base.intensity;
    material.emissiveMap=enabled?texture:base.map;material.needsUpdate=true;
  }}};
}
