import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createFootballWorld,FOOTBALL as F,bodyIntersection} from './footballWorld.mjs';
import {createPresence} from './presence.mjs';
const player=(id,x,z=F.z)=>({id,x,y:1.7,z,heading:-Math.PI/2,state:'idle',updated:1000});
for(const side of [-1,1])test(`shared ball: ${side} keeper rebounds before goal; no keeper still scores`,()=>{
 const w=createFootballWorld(),shooter=player('shooter',F.x-side*2),keeper=player('keeper',F.goalXs[side<0?0:1]-side*.6);
 assert(w.kick(shooter,1000,'shot'));let impact;
 for(let t=1020;t<=2700;t+=20){w.advance(t,[shooter,{...keeper,updated:t-20}]);if(w.snapshot().blockedBy)impact??=w.snapshot();}
 assert(impact);assert.equal(impact.blockedBy,'keeper');assert.equal(impact.scored,false);assert.equal(impact.goals,0);assert(side*impact.bounceVelocity[0]<0);assert(impact.bounceVelocity[1]>0);
 assert(side*(w.snapshot().position[0]-impact.position[0])<0);w.advance(5000,[]);assert.equal(w.snapshot().phase,'ready');
 assert(w.kick(shooter,6000,'free'));for(let t=6020;t<7800;t+=20)w.advance(t,[]);assert.equal(w.snapshot().goals,1);assert.equal(w.snapshot().scored,true);
});
test('sweep catches fast body intersections; off-path, seated, stale and behind-goal players cannot cancel a goal',()=>{
 assert.notEqual(bodyIntersection([190,.6,8],[198,.6,8],player('g',195)),null);
 assert.equal(bodyIntersection([190,4,8],[198,4,8],player('g',195)),null);
 for(const keeper of [{...player('g',195),z:14},{...player('g',195),state:'seated'},{...player('g',195),updated:-10000},player('g',199)]){
  const w=createFootballWorld();w.kick(player('s',165),1000,'shot');for(let t=1020;t<=2800;t+=20)w.advance(t,[{...keeper,updated:keeper.updated<0?keeper.updated:t-20}]);assert.equal(w.snapshot().goals,1);assert.equal(w.snapshot().blockedBy,null);
 }
});
test('keeper can move into or out of the path before impact; shooter is never its own goalkeeper',()=>{
 for(const enters of [true,false]){
  const w=createFootballWorld(),s=player('s',165);w.kick(s,1000,'shot');
  for(let t=1020;t<=2800;t+=20){const aligned=t>1900?enters:!enters;w.advance(t,[{...player('g',195,aligned?8:14),updated:t-20},{...s,x:195,updated:t-20}]);}
  assert.equal(w.snapshot().blockedBy,enters?'g':null);assert.equal(w.snapshot().goals,enters?0:1);
 }
});
function fixture(){
 let time=1000;const tabs=new Map(),seqs=new Map();const route=createPresence({identity:async r=>r.user?{issuer:'qa',subject:r.user,name:r.user}:null,now:()=>time,readJson:async r=>r.body,json:(r,status,data)=>Object.assign(r,{status,data}),fail:(status,code)=>{throw Object.assign(Error(code),{status,code});}});
 const pose=(x,z=8)=>({x,y:1.7,z,heading:-Math.PI/2,state:'idle',groundSeat:false,appearance:{body:'male',hair:'short',outfit:'vju',palette:0}});
 const raw=async(user,body,origin=true)=>{const res={};try{await route({user,body,method:'POST',headers:origin?{origin:'http://qa'}:{}},res,new URL('http://qa/api/presence'));}catch(e){res.status=e.status;res.code=e.code;}return res;};
 const msg=(user,action,p)=>{if(!tabs.has(user))tabs.set(user,randomUUID());seqs.set(user,(seqs.get(user)||0)+1);return {action,tab:tabs.get(user),seq:seqs.get(user),pose:p,...(action==='pulse'?{limit:6}:{id:randomUUID()})};};
 return {raw,pose,msg,tabs,advance:ms=>time+=ms};
}
test('two authenticated viewers see one authoritative rebound, retries are idempotent and extra tabs cannot kick',async()=>{
 const f=fixture();let a=await f.raw('a',f.msg('a','pulse',f.pose(165))),b=await f.raw('b',f.msg('b','pulse',f.pose(195)));
 const shot=f.msg('a','footballKick',f.pose(165));assert.equal((await f.raw('a',shot,false)).status,403);
 assert.equal((await f.raw(null,shot)).status,401);assert.equal((await f.raw('a',{...shot,tab:randomUUID()})).status,409);
 const fired=await f.raw('a',shot);assert.equal(fired.status,200);assert.equal((await f.raw('a',shot)).data.football.shotId,shot.id);
 assert.equal((await f.raw('b',f.msg('b','footballKick',f.pose(165)))).status,409);
 for(let i=0;i<7;i++){f.advance(250);b=await f.raw('b',f.msg('b','pulse',f.pose(195)));a=await f.raw('a',f.msg('a','pulse',f.pose(165)));}
 assert.equal(a.data.football.blockedBy,b.data.self);assert.deepEqual(a.data.football,b.data.football);assert.equal(a.data.football.goals,0);
 f.advance(2000);await f.raw('a',f.msg('a','pulse',f.pose(165)));const retry=await f.raw('a',shot);assert.equal(retry.status,200);assert.equal(retry.data.football.phase,'ready','replaying an old request never starts a second shot');
});
test('disconnected keeper does not remain solid; an expired or far-away account cannot start a shot',async()=>{
 const f=fixture();await f.raw('a',f.msg('a','pulse',f.pose(165)));await f.raw('b',f.msg('b','pulse',f.pose(195)));
 assert.equal((await f.raw('a',f.msg('a','footballKick',f.pose(120)))).status,409);
 assert.equal((await f.raw('a',f.msg('a','footballKick',f.pose(165)))).status,200);
 await f.raw('b',{action:'leave',tab:f.tabs.get('b'),seq:2});let a;
 for(let i=0;i<7;i++){f.advance(250);a=await f.raw('a',f.msg('a','pulse',f.pose(165)));}
 assert.equal(a.data.football.goals,1);assert.equal(a.data.football.blockedBy,null);
 f.advance(6001);assert.equal((await f.raw('a',f.msg('a','footballKick',f.pose(165)))).status,409);
});
