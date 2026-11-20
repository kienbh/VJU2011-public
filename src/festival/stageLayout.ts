export const STAGE={x:-34,z:-18,width:18,depth:6};
export const STAGE_SEATS=Array.from({length:32},(_,i)=>({
  id:`stage-seat-${i+1}`,number:i+1,row:Math.floor(i/8)+1,
  x:STAGE.x+[-6.95,-5.3,-3.65,-2,2,3.65,5.3,6.95][i%8],
  z:-9+Math.floor(i/8)*4,eyeY:1.46,heading:0,
}));
export type StageSeat=typeof STAGE_SEATS[number];
export function nearestStageSeat(point:{x:number;z:number}){
  return STAGE_SEATS.filter(s=>Math.hypot(s.x-point.x,s.z-point.z)<2.1)
    .sort((a,b)=>Math.hypot(a.x-point.x,a.z-point.z)-Math.hypot(b.x-point.x,b.z-point.z))[0];
}
