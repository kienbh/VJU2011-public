import * as T from 'three';
import {loadBatchAsset,disposeAsset} from './batch03Loader';

/** Explicit local preview. No collider, path, seating or camera changes. */
export function mountBatch03Preview(scene:T.Scene,camera:T.Camera){
 const entries=[{code:'H01',name:'japanese-club-house',distance:65,x:170,z:-111},{code:'H02',name:'vnu-guest-house-hotel',distance:85,x:147,z:-184}];
 const levels:T.LOD[]=[],originals:T.Object3D[]=[];
 const states:Record<string,{status:string;position?:number[];lod?:number;error?:string}>={};let disposed=false;
 const ready=Promise.all(entries.map(async item=>{
  states[item.code]={status:'loading'};const original=scene.getObjectByName(item.name),loaded:T.Group[]=[];
  try{
   if(!original?.parent)throw Error('Không tìm thấy tòa hiện có.');scene.updateMatrixWorld(true);const position=original.getWorldPosition(new T.Vector3());
   if(Math.abs(position.x-item.x)>.01||Math.abs(position.z-item.z)>.01)throw Error('Vị trí hiện hành khác manifest; giữ tòa cũ.');
   for(const index of [0,1])loaded.push((await loadBatchAsset(`${item.code}-proposal-v1-LOD${index}`)).scene);
   if(disposed){loaded.forEach(disposeAsset);return;}
   const lod=new T.LOD();lod.name=`batch03-${item.code}-proposed`;lod.position.copy(original.position);lod.quaternion.copy(original.quaternion);lod.scale.copy(original.scale);
   lod.addLevel(loaded[0],0);lod.addLevel(loaded[1],item.distance,.15);original.parent.add(lod);original.visible=false;originals.push(original);levels.push(lod);
   scene.updateMatrixWorld(true);lod.update(camera);states[item.code]={status:'ready',position:position.toArray(),lod:lod.getCurrentLevel()};
  }catch(error){loaded.forEach(disposeAsset);states[item.code]={status:'error',error:(error as Error).message};}
 }));
 const note=document.createElement('p');note.className='batch03-preview-note';note.textContent='Preview local H01/H02 · mặt tiền đề xuất, không phải phục dựng';document.querySelector('#viewport')?.append(note);
 return {ready,update(){for(const lod of levels){lod.update(camera);states[lod.name.includes('H01')?'H01':'H02'].lod=lod.getCurrentLevel();}},state:()=>states,dispose(){disposed=true;originals.forEach(o=>o.visible=true);levels.forEach(disposeAsset);note.remove();}};
}
