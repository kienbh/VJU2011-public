import * as T from 'three';
export function createRouteGuide(heightAt:(x:number,z:number)=>number){
 const root=new T.Group();root.name='navigation-ribbon';let distance=0;
 const c=document.createElement('canvas');c.width=128;c.height=32;const ctx=c.getContext('2d')!;ctx.fillStyle='#d8ab4166';ctx.fillRect(0,0,128,32);ctx.strokeStyle='#fff2b8';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(45,7);ctx.lineTo(60,16);ctx.lineTo(45,25);ctx.stroke();
 const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;
 const mat=new T.MeshBasicMaterial({map:tex,transparent:true,side:T.DoubleSide,depthTest:true,depthWrite:false});const mesh=new T.Mesh(new T.BufferGeometry(),mat);mesh.renderOrder=3;root.add(mesh);
 const beacon=new T.Mesh(new T.CylinderGeometry(.08,.08,3,6),new T.MeshBasicMaterial({color:'#ffe6a1',transparent:true,opacity:.55,depthWrite:false}));root.add(beacon);
 return {root,set(points:{x:number;z:number}[]){const pos:number[]=[],uv:number[]=[],indices:number[]=[];distance=0;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.z-a.z);if(length<.01)continue;const n=Math.ceil(length/.8),dx=(b.z-a.z)/length*.55,dz=-(b.x-a.x)/length*.55;for(let j=0;j<=n;j++){const x=a.x+(b.x-a.x)*j/n,z=a.z+(b.z-a.z)*j/n,k=pos.length/3;for(const sign of [-1,1]){const px=x+dx*sign,pz=z+dz*sign;pos.push(px,Math.max(.32,heightAt(px,pz)+.3),pz);uv.push((distance+length*j/n)/3,sign<0?0:1);}if(j<n)indices.push(k,k+1,k+2,k+1,k+3,k+2);}distance+=length;}
  const next=new T.BufferGeometry();next.setAttribute('position',new T.Float32BufferAttribute(pos,3));next.setAttribute('uv',new T.Float32BufferAttribute(uv,2));next.setIndex(indices);next.computeBoundingSphere();mesh.geometry.dispose();mesh.geometry=next;const end=points.at(-1);beacon.visible=!!end;if(end)beacon.position.set(end.x,heightAt(end.x,end.z)+1.6,end.z);
 },update(dt:number,reduced:boolean){if(!reduced)tex.offset.x-=dt*.55;},distance:()=>distance,dispose(){mesh.geometry.dispose();mat.dispose();tex.dispose();beacon.geometry.dispose();beacon.material.dispose();root.removeFromParent();}};
}
