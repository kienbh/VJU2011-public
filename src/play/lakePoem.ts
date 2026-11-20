import {SATELLITE_LAKES,lakeOutline} from '../scene/rearBackdrop';

const banks=SATELLITE_LAKES.map(lake=>lakeOutline(lake.points));
/** Use the actual curved banks, not the bounding boxes of the two lakes. */
export function nearPoetryBank(at:{x:number;z:number}){
 return banks.some(points=>points.some((a,i)=>{
  if(!i)return false;const b=points[i-1],dx=b.x-a.x,dz=b.z-a.z;
  const t=Math.max(0,Math.min(1,((at.x-a.x)*dx+(at.z-a.z)*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(at.x-a.x-t*dx,at.z-a.z-t*dz)<=8;
 }));
}
// Original public-edition verse, MIT; Vietnamese stays visible in either UI language.
export const LAKE_POEM=[
 'Gió khẽ mở trang chiều',
 'Mặt hồ gom sắc lá',
 'Bước chân dừng bên cỏ',
 'Lắng nghe một vòng xa',
 'Câu hỏi còn trên giấy',
 'Theo bóng nước đi qua',
 'Mai cùng nhau thử tiếp',
 'Từ điều nhỏ hôm qua',
];
