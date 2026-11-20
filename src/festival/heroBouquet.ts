import * as THREE from 'three';

/** Local art-review asset. Failure must never block flowers, movement or greetings. */
export function loadHeroBouquet(parent:THREE.Group){
  let attempted=false;
  return async()=>{
    if(attempted)return;attempted=true;
    if(!import.meta.env.DEV||import.meta.env.VITE_LOCAL_MESHY_REVIEW!=='1'){parent.userData.heroAsset='fallback';return;}
    try{
      const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
      const gltf=await new GLTFLoader().loadAsync('/assets/festival/hero-bouquet.glb');
      const model=gltf.scene;model.name='meshy-hero-bouquet';
      const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
      if(!Number.isFinite(size.y)||size.y<=0)throw Error('Invalid bouquet bounds');
      const scale=2.9/size.y;
      const anchor=new THREE.Group();anchor.name='hero-bouquet-display';anchor.position.set(34,.54,-2);
      model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);model.scale.setScalar(scale);
      model.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=false;o.receiveShadow=true;}});
      anchor.add(model);parent.add(anchor);parent.userData.heroAsset='loaded';
    }catch{parent.userData.heroAsset='fallback';}
  };
}
