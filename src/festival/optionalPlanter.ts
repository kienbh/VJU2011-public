import * as THREE from 'three';

/** Decorative only: one local, pre-existing GLB; never on the greeting critical path. */
export function optionalPlanter(parent:THREE.Object3D) {
  const group=new THREE.Group();group.name='garden-camellia-planter';group.position.set(52,.65,-11.6);group.rotation.y=-Math.PI/2;parent.add(group);
  const fallback=new THREE.Mesh(new THREE.CylinderGeometry(.58,.43,.8,24),new THREE.MeshStandardMaterial({color:0x786e61,roughness:.85}));
  fallback.position.y=.4;group.add(fallback);
  let started=false;
  return async()=>{
    if(started)return;started=true;
    if(import.meta.env.VITE_OPTIONAL_PLANTER!=='1'){group.userData.assetStatus='fallback';return;}
    group.userData.assetStatus='loading';
    try {
      const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
      const gltf=await new GLTFLoader().loadAsync('/assets/festival/camellia-planter.glb');
      const model=gltf.scene,bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
      const scale=2.25/size.y;if(!Number.isFinite(scale)||scale<=0)throw new Error('Invalid planter bounds');
      model.scale.setScalar(scale);model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
      model.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=false;o.receiveShadow=true;}});
      group.add(model);fallback.visible=false;group.userData.assetStatus='loaded';
    }catch {group.userData.assetStatus='fallback';}
  };
}
