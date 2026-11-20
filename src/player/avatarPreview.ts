import * as THREE from 'three';
import {createVisitorAvatar} from './visitorAvatar';
import type {Appearance} from './appearance';
/** Static-on-demand studio. Rotation is explicit, never an automatic 360-degree spin. */
export function mountAvatarPreview(host:HTMLElement,appearance:Appearance){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
  host.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','Xem trước toàn thân nhân vật 3D');
  const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xfff9ec,0x8aa4a0,2.5));const key=new THREE.DirectionalLight(0xfff0d7,3);key.position.set(-3,5,-4);scene.add(key);const fill=new THREE.DirectionalLight(0xb7d9fa,1.4);fill.position.set(3,2,2);scene.add(fill);
  const avatar=createVisitorAvatar();avatar.setAppearance(appearance);avatar.root.rotation.y=-.22;scene.add(avatar.root);
  const stand=new THREE.Mesh(new THREE.CylinderGeometry(.95,1,.1,48),new THREE.MeshStandardMaterial({color:'#b8c6b9',roughness:.7}));stand.position.y=-.04;scene.add(stand);
  const camera=new THREE.PerspectiveCamera(35,1,.1,30);camera.position.set(0,1.25,-4.9);camera.lookAt(0,1.12,0);
  function render(){const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera);}
  const observer=new ResizeObserver(render);observer.observe(host);render();
  return {setAppearance(value:Appearance){avatar.setAppearance(value);render();},turn(amount:number){avatar.root.rotation.y+=amount;render();},dispose(){observer.disconnect();const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();scene.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);}}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}};
}
