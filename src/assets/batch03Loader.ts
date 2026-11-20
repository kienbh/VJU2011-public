import {requestTimeout} from '../browserCompat';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {BATCH03} from './batch03Catalog';
export async function loadBatchAsset(id:string){
 const metadata=BATCH03.find(a=>a.id===id);if(!metadata)throw Error('Asset ngoài danh sách bàn giao.');
 const response=await fetch(metadata.file,{signal:requestTimeout(20000)});if(!response.ok)throw Error(`Không tải được ${id}.`);
 const bytes=await response.arrayBuffer();
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 if(bytes.byteLength!==metadata.bytes||digest!==metadata.sha256)throw Error(`File ${id} không khớp bản bàn giao.`);
 const gltf=await new GLTFLoader().parseAsync(bytes,'');
 const bounds=new T.Box3().setFromObject(gltf.scene);
 if(bounds.isEmpty()||![...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite)){disposeAsset(gltf.scene);throw Error('Hình học không hợp lệ.');}
 return {...gltf,metadata,bounds};
}
export function disposeAsset(root:T.Object3D){
 const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>(),skeletons=new Set<T.Skeleton>();
 root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v instanceof T.Texture)textures.add(v);}}if(o instanceof T.SkinnedMesh)skeletons.add(o.skeleton);});
 geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{t.dispose();if(typeof ImageBitmap!=='undefined'&&t.image instanceof ImageBitmap)t.image.close();});skeletons.forEach(s=>s.dispose());root.removeFromParent();
}
