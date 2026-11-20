export type FishPoint = { x:number; z:number };
export type FoodPatch = FishPoint & { id:number; born:number; expires:number; landed:boolean; diners:Set<number>; eaten:Set<number> };

/** Session-local leisure interaction: no account, server writes or shared economy. */
export function createFishFood(now:()=>number = Date.now) {
  let charges=3, refillAt=0, serial=0;
  const patches:FoodPatch[]=[];
  function state(){
    if(refillAt&&now()>=refillAt){charges=3;refillAt=0;}
    return {charges,seconds:refillAt?Math.max(0,Math.ceil((refillAt-now())/1000)):0};
  }
  function throwAt(point:FishPoint,fish:FishPoint[],time:number){
    if(!state().charges||!Number.isFinite(point.x)||!Number.isFinite(point.z))return null;
    charges--;if(!charges)refillAt=now()+60000;
    // Rendering may pause while away/hidden. Never exceed the three-patch particle pool.
    if(patches.length>=3)patches.shift();
    const occupied=new Set(patches.flatMap(p=>[...p.diners]));
    const diners=fish.map((f,id)=>({id,d:Math.hypot(f.x-point.x,f.z-point.z)}))
      .filter(f=>!occupied.has(f.id)&&f.d<=38).sort((a,b)=>a.d-b.d).slice(0,5).map(f=>f.id);
    const patch:FoodPatch={...point,id:++serial,born:time,expires:now()+25000,landed:false,diners:new Set(diners),eaten:new Set()};
    patches.push(patch);return patch;
  }
  function update(time:number,fish:FishPoint[]){
    for(let i=patches.length-1;i>=0;i--){
      const p=patches[i];p.landed=time-p.born>=.65;
      if(p.landed)for(const id of p.diners){const f=fish[id];if(f&&Math.hypot(f.x-p.x,f.z-p.z)<1.3)p.eaten.add(id);}
      if(p.eaten.size>=5||time-p.born>25||now()>=p.expires)patches.splice(i,1);
    }
  }
  function target(id:number){return patches.find(p=>p.landed&&p.diners.has(id)&&!p.eaten.has(id));}
  return {state,throwAt,update,target,patches};
}
