import {tr} from '../i18n/index.ts';
import * as T from 'three';
import {FOOTBALL as F,createFootballWorld,sampleFootball,shotDirection,type BallFrame} from '../../server/footballWorld.mjs';
type Player={x:number;y:number;z:number};
type Events={send(id:string,heading:number):Promise<{football:BallFrame;self:string}>;onKick(heading:number):void;onGoal(n:number):void;announce(text:string):void};
/** Immediate local shot prediction; only server snapshots may award a goal or block. */
/** Immediate local shot prediction; only server snapshots may award a goal or block. */
export function createCampusFootball(ball:T.Object3D,events:Events){
 let frame=createFootballWorld().snapshot(),authoritative=frame,self:string|null=null,received=0,predictedAt=0,pending=false,personalGoals=0,scoreSeen:string|null=null,blockSeen:string|null=null;
 const arrow=new T.ArrowHelper(new T.Vector3(1,0,0),new T.Vector3(F.x,.23,F.z),3.2,0xffd36b,.65,.38);arrow.name='football-aim';arrow.visible=false;ball.parent?.add(arrow);ball.position.set(F.x,F.ground+F.radius,F.z);
 const connected=()=>!!self&&Date.now()-received<2000;
 const near=(p:{x:number;z:number})=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.hypot(p.x-F.x,p.z-F.z)<=3.2;
 function adopt(next:BallFrame,id:string){
  if(!next||!['ready','shooting','rebound','goal'].includes(next.phase)||!Number.isFinite(next.at)||next.at<authoritative.at||next.at===authoritative.at&&next.revision<authoritative.revision)return;
  authoritative=next;received=Date.now();self=id;
  // A pulse sent before the optimistic kick must not snap the ball back while the request is in flight.
  if(!pending||next.shotId===frame.shotId)frame=next;
  if(next.scored&&next.shotId!==scoreSeen){scoreSeen=next.shotId;if(next.shooter===self){personalGoals++;events.onGoal(personalGoals);}}
  if(next.blockedBy&&next.shotId!==blockSeen){blockSeen=next.shotId;events.announce(next.blockedBy===self?tr('⚽ Bạn đã cản bóng!'): tr('⚽ Bóng trúng người chắn và bật ra!'));}
 }
 function kick(p:Player,heading:number,enabled:boolean){
  if(!enabled||pending||frame.phase!=='ready'||!near(p)||!Number.isFinite(heading))return false;
  if(!connected()){events.announce(tr('Đang kết nối sân bóng. Hãy thử lại khi có kết nối.'));return false;}
  const id=crypto.randomUUID(),world=createFootballWorld(),time=authoritative.at+Math.max(0,Date.now()-received);
  if(!world.kick({id:self!,...p,heading,state:'idle',updated:time},time,id))return false;
  frame={...world.snapshot(),goals:authoritative.goals};pending=true;predictedAt=Date.now();arrow.visible=false;
  const d=shotDirection(p,heading);events.onKick(Math.atan2(-d[0],-d[2]));
  void events.send(id,heading).then(result=>{pending=false;frame=authoritative;adopt(result.football,result.self);}).catch((e:Error)=>{pending=false;frame=authoritative;events.announce(e.message||tr('Chưa xác nhận được cú sút.'));});return true;
 }
 return {kick,adopt,near,
  aim(p:Player,heading:number,enabled:boolean){arrow.visible=enabled&&connected()&&!pending&&frame.phase==='ready'&&near(p);if(arrow.visible)arrow.setDirection(new T.Vector3(...shotDirection(p,heading) as [number,number,number]));},
  update(dt:number,_enabled:boolean){
   if(!Number.isFinite(dt)||dt<=0)return;
   // Continue shared play while this viewer reads a dialog; never pause everybody's ball.
   const age=Math.max(0,Date.now()-received),time=pending?frame.startedAt+Math.max(0,Date.now()-predictedAt):frame.at+Math.min(age,500);
   const position=sampleFootball(frame,time);ball.position.set(position[0],position[1],position[2]);
   if(frame.phase!=='ready')ball.rotateOnWorldAxis(new T.Vector3(frame.direction[2],0,-frame.direction[0]),Math.min(dt,.1)*20/F.radius);
   else ball.rotation.set(0,0,0);
   if(!connected())arrow.visible=false;
  },
  state:()=>({...frame,goals:personalGoals,totalGoals:frame.goals,position:ball.position.toArray(),connected:connected(),pending})};
}
export type CampusFootball=ReturnType<typeof createCampusFootball>;
