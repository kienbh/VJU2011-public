import * as THREE from 'three';
import {FOOTBALL as F} from '../scene/footballLayout.ts';
type Player={x:number;z:number};
/** A shot travels along player -> ball, independent of the camera's heading. */
export function createFootball(ball:THREE.Object3D,events:{onKick(heading:number):void;onGoal(goals:number):void}){
 const home=new THREE.Vector3(F.x,F.ground+F.radius,F.z),direction=new THREE.Vector3(),end=new THREE.Vector3();
 const arrow=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),home.clone(),3.2,0xffd36b,.65,.38);arrow.name='football-aim';arrow.visible=false;ball.parent?.add(arrow);
 let phase:'ready'|'shooting'|'goal'='ready',elapsed=0,goals=0,goalX=F.goalXs[1] as number,scored=false,duration=1.6;
 ball.position.copy(home);
 const near=(p:Player)=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.hypot(p.x-F.x,p.z-F.z)<=3.2;
 function vector(p:Player,heading:number){const v=new THREE.Vector3(F.x-p.x,0,F.z-p.z);return v.lengthSq()>.0025?v.normalize():v.set(-Math.sin(heading),0,-Math.cos(heading));}
 function aim(p:Player,heading:number,enabled:boolean){arrow.visible=enabled&&phase==='ready'&&near(p);if(arrow.visible){arrow.position.set(F.x,.23,F.z);arrow.setDirection(vector(p,heading));}}
 function kick(p:Player,heading:number,enabled:boolean){
  if(!enabled||phase!=='ready'||!near(p)||!Number.isFinite(heading))return false;
  direction.copy(vector(p,heading));goalX=F.goalXs[direction.x<0?0:1];
  const xDistance=Math.abs(direction.x)>.0001?Math.abs((goalX+Math.sign(direction.x)*1.25-F.x)/direction.x):Infinity;
  const zDistance=Math.abs(direction.z)>.0001?20/Math.abs(direction.z):Infinity;
  end.copy(home).addScaledVector(direction,Math.min(xDistance,zDistance));duration=home.distanceTo(end)/20;
  phase='shooting';elapsed=0;scored=false;arrow.visible=false;
  events.onKick(Math.atan2(-direction.x,-direction.z));return true;
 }
 function update(dt:number,enabled:boolean){
  if(!enabled||phase==='ready'||!Number.isFinite(dt)||dt<=0)return;
  elapsed+=Math.min(dt,.1);
  if(phase==='goal'){
   if(elapsed>=(scored?1.3:.75)){phase='ready';elapsed=0;ball.position.copy(home);ball.rotation.set(0,0,0);}return;
  }
  const previous=ball.position.clone(),t=THREE.MathUtils.clamp(elapsed/duration,0,1);
  ball.position.lerpVectors(home,end,t);ball.position.y=home.y+4*1.6*t*(1-t);
  ball.rotateOnWorldAxis(new THREE.Vector3(direction.z,0,-direction.x),20*Math.min(dt,.1)/F.radius);
  const side=Math.sign(direction.x),line=goalX+side*F.radius;
  if(!scored&&side!==0&&side*(previous.x-line)<=0&&side*(ball.position.x-line)>0){
   const fraction=(line-home.x)/(end.x-home.x),z=THREE.MathUtils.lerp(home.z,end.z,fraction),y=home.y+4*1.6*fraction*(1-fraction);
   if(Math.abs(z-F.z)+F.radius<F.goal.width/2&&y+F.radius<F.goal.height){scored=true;goals++;events.onGoal(goals);}
  }
  if(t===1){phase='goal';elapsed=0;}
 }
 return {kick,update,near,aim,state:()=>({phase,goals,goalX,scored,direction:direction.toArray(),position:ball.position.toArray()})};
}
export type Football=ReturnType<typeof createFootball>;
