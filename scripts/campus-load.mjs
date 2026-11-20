// Synthetic localhost only, in-memory DB. Never accepts a live URL.
import {createAppServer} from '../server/app.mjs';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {mkdir,writeFile,mkdtemp} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const seconds=Number(process.argv[2]||600),capacity=Number(process.argv[3]||50),waiting=Number(process.argv[4]||20);
if(!Number.isInteger(seconds)||seconds<5||seconds>600||![10,25,50,100].includes(capacity)||waiting<0||waiting>200)throw Error('Use seconds 5..600, capacity 10/25/50/100, waiting 0..200');
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty=!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();
const temporary=await mkdtemp(path.join(tmpdir(),'vju-campus-load-')),dbPath=path.join(temporary,'qa.sqlite');
const server=createAppServer({dbPath,adminToken:randomBytes(32).toString('base64url'),trialAccounts:true,seedSamples:false,campusCapacity:capacity,logger:()=>{}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,users=[],latency=[],statuses={},errors=[];
server.on('request',(req,res)=>res.once('finish',()=>{if(res.statusCode===401||res.statusCode===409){const db=new DatabaseSync(dbPath,{readOnly:true}),c=Object.fromEntries((req.headers.cookie||'').split(';').map(v=>v.trim().split('='))),hash=createHash('sha256').update(c.vju_guest||'').digest('hex'),row=db.prepare('SELECT expires_at FROM trial_guests WHERE token_hash=?').get(hash);console.error(JSON.stringify({diagnostic:'identity-or-admission',status:res.statusCode,expectedOwner:users.find(u=>u.cookie===req.headers.cookie)?.owner,actualOwner:req.participantKey,path:req.url,matchedFixture:users.findIndex(u=>u.cookie===req.headers.cookie),cookieLength:req.headers.cookie?.length,active:c.vju_guest_active,now:Date.now(),row,rows:db.prepare('SELECT count(*) n FROM trial_guests').get().n,identityCached:Object.hasOwn(req,'participantIdentity'),identityPresent:!!req.participantIdentity,qaDatabase:dbPath}));db.close();}}));
async function call(u,route,body){const start=performance.now(),r=await fetch(base+route,{method:body?'POST':'GET',headers:{Origin:base,'Content-Type':'application/json',Cookie:u.cookie||''},body:body?JSON.stringify(body):undefined});const d=await r.json();latency.push(performance.now()-start);statuses[r.status]=(statuses[r.status]||0)+1;if(!r.ok){const session=await fetch(base+'/api/auth/session',{headers:{Cookie:u.cookie}}).then(r=>r.json());const admission=await fetch(base+'/api/campus?tab='+u.tab,{headers:{Cookie:u.cookie}}).then(r=>r.json());errors.push({route,status:r.status,code:d.code,index:u.i,now:Date.now(),sessionOwner:session.account?.id,expectedOwner:u.owner,admission,maxLatency:latency.reduce((a,b)=>Math.max(a,b),0)});}return {d,cookie:r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')};}
try{
 for(let i=0;i<capacity+waiting;i++){const u={tab:randomUUID(),seq:0,poseSeq:0,cookie:'',i};const login=await call(u,'/api/auth/guest',{mode:'anonymous'});u.cookie=login.cookie;u.owner=login.d.account.id;users.push(u);const {d}=await call(u,'/api/campus',{action:'enter',tab:u.tab,seq:++u.seq,activity:0});if(d.state!==(i<capacity?'admitted':'queued'))throw Error('Unexpected admission '+i);}
 const start=Date.now();let tick=0,lastLog=0;
 while(Date.now()-start<seconds*1000){
  const elapsed=Date.now()-start;
  const calls=users.slice(0,capacity).map(u=>call(u,'/api/presence',{action:'pulse',tab:u.tab,seq:++u.poseSeq,limit:6,pose:{x:120+(u.i%10),y:1.7,z:-110+Math.floor(u.i/10),heading:0,state:'walking',groundSeat:false,appearance:{body:'male',hair:'short',outfit:'vju',palette:0}}}));
  if(tick%20===0){calls.push(...users.map(u=>u.i<capacity?call(u,'/api/campus',{action:'pulse',tab:u.tab,seq:++u.seq,activity:Math.floor(elapsed/30000)}):call(u,'/api/campus?tab='+u.tab)));}
  await Promise.all(calls);if(errors.length)throw Error(JSON.stringify(errors.slice(0,3)));
  if(elapsed-lastLog>=60000){lastLog=elapsed;console.log(JSON.stringify({elapsedSeconds:Math.round(elapsed/1000),requests:latency.length,statuses}));}
  tick++;await new Promise(r=>setTimeout(r,Math.max(0,start+tick*250-Date.now())));
 }
 const check=await call(users[capacity-1],'/api/campus?tab='+users[capacity-1].tab);if(check.d.online!==capacity||check.d.queued!==waiting)throw Error('Capacity drift');
 latency.sort((a,b)=>a-b);const result={sha,dirty,seconds,capacity,waiting,elapsedSeconds:(Date.now()-start)/1000,requests:latency.length,statuses,p95Ms:latency[Math.floor(latency.length*.95)],maxMs:latency.at(-1),heapMB:process.memoryUsage().heapUsed/1048576,errors,scope:process.platform+' '+process.version+' localhost synthetic HTTP clients; no browser/device/server capacity claim'};
 await mkdir('.local/release-qa',{recursive:true});await writeFile(`.local/release-qa/campus-load-${capacity}-${seconds}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await new Promise(r=>server.close(r));}
