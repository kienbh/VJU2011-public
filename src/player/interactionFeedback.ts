import * as T from 'three';
export function createInteractionFeedback(scene:T.Scene,heightAt:(x:number,z:number)=>number){
 const ring=new T.Mesh(new T.RingGeometry(.8,1.02,48),new T.MeshBasicMaterial({color:'#ffdc85',transparent:true,opacity:.65,side:T.DoubleSide,depthTest:false,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.renderOrder=6;ring.visible=false;scene.add(ring);
 const positions=new Float32Array(40*3),g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));g.setDrawRange(0,0);const m=new T.PointsMaterial({color:'#ffb9d0',size:.12,transparent:true,depthWrite:false}),burst=new T.Points(g,m);scene.add(burst);
 let pending:T.Vector3|null=null,age=10,count=40,origin=new T.Vector3();
 function queue(at:{x:number;z:number}){pending=new T.Vector3(at.x,heightAt(at.x,at.z)+.8,at.z);}
 return {queue,update(dt:number,focus:{x:number;z:number}|null,blocked:boolean,reduced:boolean,density:number){ring.visible=!!focus&&!blocked;if(focus)ring.position.set(focus.x,Math.max(.16,heightAt(focus.x,focus.z))+.05,focus.z);
  if(pending&&!blocked){origin.copy(pending);pending=null;age=0;count=Math.round(12+28*density);if(!reduced)try{navigator.vibrate?.(18);}catch{}}
  age+=dt;burst.visible=age<1.3&&!blocked;if(!burst.visible)return;for(let i=0;i<count;i++){const a=i*2.399,r=(reduced?.7:age*1.5)*(1+i%3*.12);positions[i*3]=origin.x+Math.cos(a)*r;positions[i*3+1]=origin.y+(reduced?.3:age*2-age*age);positions[i*3+2]=origin.z+Math.sin(a)*r;}g.setDrawRange(0,count);g.attributes.position.needsUpdate=true;m.opacity=reduced?.7:Math.max(0,1-age/1.3);
 },state:()=>({focus:ring.visible?ring.position.toArray():null,pending:!!pending,burst:burst.visible})};
}
