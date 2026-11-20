/** Pure shared rules: the server owns shots, collisions and goals; clients only sample trajectories. */
export const FOOTBALL={x:167,z:8,ground:.13,radius:.36,goalXs:[138,196],goal:{width:7.4,height:2.7,depth:1.9,post:.16}};
const F=FOOTBALL,home=[F.x,F.ground+F.radius,F.z],clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export function shotDirection(p,heading){const x=F.x-p.x,z=F.z-p.z,n=Math.hypot(x,z);return n>.05?[x/n,0,z/n]:[-Math.sin(heading),0,-Math.cos(heading)];}
export function sampleFootball(s,time){
 if(s.phase==='ready')return [...home];
 if(s.blockedAt!==null&&time>=s.blockedAt){
  const t=clamp((time-s.blockedAt)/1000,0,1.6),[x,y,z]=s.bounceStart,[vx,vy,vz]=s.bounceVelocity;
  const hit=(vy+Math.sqrt(vy*vy+19.6*Math.max(0,y-home[1])))/9.8;
  const height=t<=hit?y+vy*t-4.9*t*t:home[1]+Math.max(0,(9.8*hit-vy)*.3*(t-hit)-4.9*(t-hit)**2);
  return [x+vx*t,Math.max(home[1],height),z+vz*t];
 }
 const t=clamp((time-s.startedAt)/s.duration,0,1);
 return [F.x+(s.end[0]-F.x)*t,home[1]+6.4*t*(1-t),F.z+(s.end[2]-F.z)*t];
}
/** Swept ball against an upright body, including vertical bounds; prevents fast shots tunnelling. */
export function bodyIntersection(a,b,p){
 const r=.52+F.radius,dx=b[0]-a[0],dz=b[2]-a[2],x=a[0]-p.x,z=a[2]-p.z,A=dx*dx+dz*dz,B=2*(x*dx+z*dz),C=x*x+z*z-r*r;
 let lo=0,hi=1;
 if(A<1e-12){if(C>0)return null;}else{const d=B*B-4*A*C;if(d<0)return null;lo=Math.max(lo,(-B-Math.sqrt(d))/(2*A));hi=Math.min(hi,(-B+Math.sqrt(d))/(2*A));}
 const feet=p.y-1.7,min=feet-F.radius,max=feet+2.1+F.radius,dy=b[1]-a[1];
 if(Math.abs(dy)<1e-12){if(a[1]<min||a[1]>max)return null;}else{const u=(min-a[1])/dy,v=(max-a[1])/dy;lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));}
 return lo<=hi&&lo<=1&&hi>=0?clamp(lo,0,1):null;
}
export function createFootballWorld(){
 let s={revision:0,phase:'ready',shotId:null,shooter:null,startedAt:0,duration:1,goalX:F.goalXs[1],direction:[0,0,0],end:[...home],goals:0,scored:false,blockedBy:null,blockedAt:null,bounceStart:[...home],bounceVelocity:[0,0,0],resetAt:0,at:0,position:[...home]},last=0;
 function reset(time){s={...s,revision:s.revision+1,phase:'ready',shotId:null,shooter:null,scored:false,blockedBy:null,blockedAt:null,at:time,position:[...home]};last=time;}
 function kick(p,time,id){
  if(s.phase!=='ready'||p.state==='seated'||![p.x,p.y,p.z,p.heading,time].every(Number.isFinite)||Math.abs(p.y-1.7)>.6||Math.hypot(p.x-F.x,p.z-F.z)>3.2)return false;
  const direction=shotDirection(p,p.heading),goalX=F.goalXs[direction[0]<0?0:1];
  const xd=Math.abs(direction[0])>.0001?Math.abs((goalX+Math.sign(direction[0])*1.25-F.x)/direction[0]):Infinity,zd=Math.abs(direction[2])>.0001?20/Math.abs(direction[2]):Infinity,dist=Math.min(xd,zd);
  s={...s,revision:s.revision+1,phase:'shooting',shotId:id,shooter:p.id,startedAt:time,duration:dist/20*1000,goalX,direction,end:[F.x+direction[0]*dist,home[1],F.z+direction[2]*dist],scored:false,blockedBy:null,blockedAt:null,at:time,position:[...home]};last=time;return true;
 }
 function advance(time,players){
  if(!Number.isFinite(time)||time<last)return;
  if(s.phase==='ready'){last=time;s.at=time;return;}
  // No unbounded catch-up after an empty campus or a suspended process.
  if(time-last>8000){reset(time);return;}
  while(last<time){
   const next=Math.min(time,last+20),a=sampleFootball(s,last),b=sampleFootball(s,next);
   if(s.phase==='shooting'){
    const side=Math.sign(s.direction[0]),line=s.goalX+side*F.radius;
    const goalFraction=!s.scored&&side&&side*(a[0]-line)<=0&&side*(b[0]-line)>0?(line-a[0])/(b[0]-a[0]):Infinity;
    let hit=null,fraction=Infinity;
    for(const p of players){
     if(p.id===s.shooter||p.state==='seated'||last-p.updated>1200||p.updated>next||Math.abs(p.y-1.7)>.6||p.x<135||p.x>199||Math.abs(p.z-F.z)>21)continue;
     const t=bodyIntersection(a,b,p);if(t!==null&&(t<fraction||t===fraction&&p.id<(hit?.id||''))){hit=p;fraction=t;}
    }
    if(hit&&!s.scored&&fraction<=goalFraction){
     const point=a.map((v,i)=>v+(b[i]-v)*fraction),impact=last+(next-last)*fraction;
     let nx=point[0]-hit.x,nz=point[2]-hit.z,n=Math.hypot(nx,nz);if(n<.001){nx=-s.direction[0];nz=-s.direction[2];n=1;}nx/=n;nz/=n;
     const dot=s.direction[0]*nx+s.direction[2]*nz;
     // Reflect from the body; a small outward component also resolves initial overlap.
     const vx=(s.direction[0]-2*Math.min(0,dot)*nx)*11+nx*1.5,vz=(s.direction[2]-2*Math.min(0,dot)*nz)*11+nz*1.5;
     s={...s,revision:s.revision+1,phase:'rebound',blockedBy:hit.id,blockedAt:impact,bounceStart:point,bounceVelocity:[vx,4.4,vz],resetAt:impact+1600};
    }else if(goalFraction!==Infinity){
     const y=a[1]+(b[1]-a[1])*goalFraction,z=a[2]+(b[2]-a[2])*goalFraction;
     if(Math.abs(z-F.z)+F.radius<F.goal.width/2&&y+F.radius<F.goal.height){s.scored=true;s.goals++;s.revision++;}
    }
    if(s.phase==='shooting'&&next>=s.startedAt+s.duration){s.phase='goal';s.resetAt=s.startedAt+s.duration+(s.scored?1300:750);}
   }
   last=next;if((s.phase==='goal'||s.phase==='rebound')&&next>=s.resetAt){reset(time);break;}
  }
  s.at=time;s.position=sampleFootball(s,time);
 }
 return {kick,advance,snapshot:()=>structuredClone(s)};
}
