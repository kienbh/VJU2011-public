import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createAppServer} from './app.mjs';
import {clientAddress} from './rateIdentity.mjs';
async function fixture(t,options={}){
 const app=createAppServer({dbPath:':memory:',adminToken:'qa-token-'.repeat(8),trialAccounts:true,seedSamples:false,logger:()=>{},...options});await new Promise(r=>app.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.address().port;t.after(()=>new Promise(r=>app.close(r)));
 const call=async(path,body,cookie='',headers={})=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie,...headers},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')};};
 return {call};
}
test('200 identities each make 20 writes from one IP; per-account abuse only blocks that account',async t=>{
 const f=await fixture(t),users=[];
 for(let i=0;i<200;i++){const r=await f.call('/api/auth/guest',{mode:'anonymous'});assert.equal(r.status,200);users.push({cookie:r.cookie,tab:randomUUID(),seq:0});}
 const pulse=u=>f.call('/api/campus',{action:'pulse',tab:u.tab,seq:++u.seq,activity:0},u.cookie);
 for(let step=0;step<20;step++)assert.ok((await Promise.all(users.map(pulse))).every(r=>r.status===200));
 for(let i=0;i<100;i++)assert.equal((await pulse(users[0])).status,200);
 assert.equal((await pulse(users[0])).status,429);assert.equal((await pulse(users[1])).status,200);
});
test('trusted proxy opt-in separates 150 addresses, still limits one address, ignores forged headers by default',async t=>{
 const f=await fixture(t,{trustedClientIpHeader:'x-real-ip',loginRateLimit:120});
 for(let i=0;i<150;i++)assert.equal((await f.call('/api/auth/guest',{mode:'anonymous'},'',{'x-real-ip':`192.0.2.${i+1}`})).status,200);
 for(let i=0;i<120;i++)assert.equal((await f.call('/api/auth/guest',{mode:'anonymous'},'',{'x-real-ip':'198.51.100.1'})).status,200);
 assert.equal((await f.call('/api/auth/guest',{mode:'anonymous'},'',{'x-real-ip':'198.51.100.1'})).status,429);
 const req={socket:{remoteAddress:'127.0.0.1'},headers:{'x-real-ip':'192.0.2.4'}};
 assert.equal(clientAddress(req),'127.0.0.1');assert.equal(clientAddress({...req,socket:{remoteAddress:'203.0.113.1'}},'x-real-ip'),'203.0.113.1');assert.equal(clientAddress({...req,headers:{'x-real-ip':'192.0.2.4,192.0.2.5'}},'x-real-ip'),'127.0.0.1');
});
test('campus required for presence and tea; leave is ordered and releases tea immediately',async t=>{
 const f=await fixture(t,{campusCapacity:1});const u=await f.call('/api/auth/guest',{mode:'anonymous'}),tab=randomUUID();
 assert.equal((await f.call('/api/tea',{action:'join',seat:0},u.cookie)).data.code,'CAMPUS_REQUIRED');
 assert.equal((await f.call('/api/campus',{action:'enter',tab,seq:1,activity:0},u.cookie)).data.state,'admitted');
 assert.equal((await f.call('/api/tea',{action:'join',seat:0},u.cookie)).status,200);
 await f.call('/api/campus',{action:'leave',tab,seq:3,activity:0},u.cookie);
 assert.equal((await f.call('/api/campus',{action:'enter',tab,seq:2,activity:0},u.cookie)).data.state,'outside');
 assert.equal((await f.call('/api/tea',null,u.cookie)).data.members.length,0);
});
test('waiting cannot start games or earn reading time; idle removes reading lease without deleting shelf',async t=>{
 let now=1000;const f=await fixture(t,{campusCapacity:1,campusNow:()=>now}),u=await f.call('/api/auth/guest',{mode:'anonymous'}),tab=randomUUID(),book=randomUUID();
 assert.equal((await f.call('/api/play/start',{kind:'green'},u.cookie,{'Idempotency-Key':randomUUID()})).data.code,'CAMPUS_REQUIRED');
 await f.call('/api/library/book',{id:book,title:'QA book',author:'QA',status:'reading'},u.cookie);
 assert.equal((await f.call('/api/library/read',{action:'start',book},u.cookie)).data.code,'CAMPUS_REQUIRED');
 await f.call('/api/campus',{action:'enter',tab,seq:1,activity:0},u.cookie);
 assert.equal((await f.call('/api/library/read',{action:'start',book},u.cookie)).status,200);
 now+=300000;
 assert.equal((await f.call('/api/campus',{action:'pulse',tab,seq:2,activity:0},u.cookie)).data.reason,'idle');
 const shelf=await f.call('/api/library',null,u.cookie);assert.equal(shelf.data.session,null);assert.equal(shelf.data.books.length,1);assert.equal(shelf.data.seconds,0);
 assert.ok((await f.call('/api/auth/session',null,u.cookie)).data.account);
});
