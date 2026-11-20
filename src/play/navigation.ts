import {tr} from '../i18n/index.ts';
import {CAMPFIRE_ENTRY,CAMPFIRE_TITLE} from './campfireLayout';
import {createRoutePlanner,ROUTE_RADIUS} from './routePlanner';
import type {Collider} from '../types';
import {isWalkable,type GroundPoint,type WalkBounds} from '../player/collision';
export const PLACES=[
 {id:'plaza',name:tr('Sân Tri Ân'),x:20,z:23,kind:'visit'},
 {id:'green',name:tr('Trạm sân trường xanh'),x:135,z:-34,kind:'green'},
 {id:'library',name:tr('Cửa vào thư viện VJU'),x:170,z:-39,kind:'visit'},
 {id:'club',name:'Club House',x:170,z:-99,kind:'visit'},
 {id:'campfire',name:CAMPFIRE_TITLE,...CAMPFIRE_ENTRY,kind:'rest'},
 {id:'tea',name:tr('Trà đá dưới tán bàng'),x:129,z:-114,kind:'rest'},
 {id:'sakura',name:tr('Góc anh đào'),x:111,z:-115,kind:'rest'},
 {id:'lotus',name:tr('Ao sen · Một khoảng yên'),x:106,z:-181,kind:'rest'},
 {id:'hotel',name:tr('Sân nhà khách'),x:147,z:-173,kind:'visit'},
 {id:'football',name:tr('Sân bóng'),x:165,z:10,kind:'visit'},
 {id:'gate',name:tr('Cổng chính'),x:84,z:61,kind:'visit'},
 {id:'board',name:tr('Bảng Tri Ân'),x:0,z:18,kind:'visit'},
 {id:'flowers',name:tr('Vườn Hoa Tri Ân'),x:34,z:11,kind:'visit'},
 {id:'plant',name:tr('Vườn cắm hoa'),x:-39,z:23,kind:'visit'},
 {id:'reflection',name:tr('Góc suy ngẫm'),x:-58,z:-3,kind:'visit'},
 {id:'feedback',name:tr('Hộp thư góp ý'),x:-52,z:-22,kind:'visit'},
 {id:'stage',name:tr('Sân khấu'),x:-34,z:9,kind:'visit'},
] as const;
export const PLACE_GROUPS=[{id:'festival',name:tr('Lễ hội')},{id:'explore',name:tr('Khám phá')},{id:'rest',name:tr('Nghỉ ngơi')}] as const;
export function placeGroup(p:{id:string;kind:string}){return p.kind==='rest'||p.id==='hotel'?'rest':['plaza','board','flowers','plant','reflection','stage'].includes(p.id)?'festival':'explore';}
export type Place=typeof PLACES[number];
export function clearSegment(a:GroundPoint,b:GroundPoint,colliders:Collider[],bounds:WalkBounds){
 const n=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.4);
 for(let i=0;i<=n;i++)if(!isWalkable({x:a.x+(b.x-a.x)*i/(n||1),z:a.z+(b.z-a.z)*i/(n||1)},colliders,bounds,ROUTE_RADIUS))return false;
 return true;
}
export function findRoute(start:GroundPoint,end:GroundPoint,colliders:Collider[],bounds:WalkBounds,planner=createRoutePlanner(colliders,bounds)):GroundPoint[]{
 // Prefer the established land-strip lane when visiting the far bank, not a shortcut skimming water.
 // The new west-bank clearing belongs to the far bank too. Crossing the old
 // z-only threshold here made hotel-to-bbq routes double back down the lane.
 const farBank=(p:GroundPoint)=>p.z<-168||(p.x>=40&&p.x<81.5&&p.z<-155);
 if(farBank(start)!==farBank(end)){
  const anchors=[{x:84,z:-119},{x:84,z:-174}];if(farBank(start))anchors.reverse();
  const points=[start,...anchors,end],result:GroundPoint[]=[];
  for(let i=1;i<points.length;i++){const part=planner.find(points[i-1],points[i]);if(!part.length)return [];result.push(...(i===1?part:part.slice(1)));}return result;
 }
 return planner.find(start,end);
}
