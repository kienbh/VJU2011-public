import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createAppServer} from './app.mjs';
const token='feedback-local-test-'.repeat(3);
async function fixture(t){
 const server=createAppServer({dbPath:':memory:',adminToken:token,seedSamples:false,trialAccounts:true});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const base=`http://127.0.0.1:${server.address().port}`;
 async function call(path,{body,cookie='',admin=false,key,origin=base}={}){
  const res=await fetch(base+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(origin?{Origin:origin}:{}),Cookie:cookie,...(admin?{Authorization:`Bearer ${token}`} : {}),...(key?{'Idempotency-Key':key}:{})},body:body?JSON.stringify(body):undefined});
  return {status:res.status,data:await res.json(),cookies:res.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ')};
 }
 const guest=async(mode='guest')=>(await call('/api/auth/guest',{body:{mode,name:'QA student'}})).cookies;
 const payload={category:'bug',message:'Hộp thư góp ý thử nghiệm riêng <img src=x onerror=alert(1)>',contact:'',includeName:false};
 return {call,guest,payload,send:(cookie,body=payload,key=randomUUID())=>call('/api/feedback',{cookie,body,key})};
}
test('feedback requires identity, valid same origin, valid payload, and is never public',async t=>{
 const f=await fixture(t),cookie=await f.guest();
 assert.equal((await f.send('')).status,401);
 for(const origin of [null,'https://other.invalid'])assert.equal((await f.call('/api/feedback',{cookie,body:f.payload,key:randomUUID(),origin})).status,403);
 for(const body of [{...f.payload,message:'short'},{...f.payload,message:'x'.repeat(2001)},{...f.payload,category:'bad'},{...f.payload,contact:'x'.repeat(121)},{...f.payload,owner:'forged'}])assert.equal((await f.send(cookie,body)).status,400);
 assert.equal((await f.call('/api/feedback',{cookie})).status,405);
 assert.equal((await f.call('/api/admin/feedback',{cookie})).status,401);
 const result=await f.send(cookie);assert.equal(result.status,201);
 assert.equal((await f.call('/api/greetings')).data.greetings.length,0);
 assert.equal((await f.call('/api/auth/session',{cookie})).data.account.used,0);
 const list=(await f.call('/api/admin/feedback',{admin:true})).data;
 assert.equal(list.total,1);assert.equal(list.entries[0].message,f.payload.message);
 assert.equal(list.entries[0].displayName,'');assert(!JSON.stringify(list).includes('owner'));assert(!JSON.stringify(list).includes('request_key'));
});
test('feedback name is opt in, anonymous never reveals guest name, admin can process and reopen',async t=>{
 const f=await fixture(t),cookie=await f.guest(),anon=await f.guest('anonymous');
 const item=await f.send(cookie,{...f.payload,includeName:true,contact:'qa@example.invalid'});
 await f.send(anon,{...f.payload,includeName:true});
 const list=(await f.call('/api/admin/feedback',{admin:true})).data.entries;
 assert.equal(list.find(e=>e.id===item.data.id).displayName,'QA student');assert.equal(list.find(e=>e.id!==item.data.id).displayName,'');
 assert.equal((await f.call('/api/admin/feedback/'+item.data.id,{cookie,body:{status:'done'}})).status,401);
 assert.equal((await f.call('/api/admin/feedback/'+item.data.id,{admin:true,body:{status:'done'},origin:null})).status,403);
 assert.equal((await f.call('/api/admin/feedback/'+item.data.id,{admin:true,body:{status:'done'}})).status,200);
 assert.equal((await f.call('/api/admin/feedback?status=done',{admin:true})).data.entries[0].id,item.data.id);
 await f.call('/api/admin/feedback/'+item.data.id,{admin:true,body:{status:'new'}});
 assert.equal((await f.call('/api/admin/feedback',{admin:true})).data.total,2);
});
test('feedback retries do not duplicate, mismatched owner or content rejected, quota independent',async t=>{
 const f=await fixture(t),a=await f.guest(),b=await f.guest(),key=randomUUID();
 const first=await f.send(a,f.payload,key),retry=await f.send(a,f.payload,key);assert.equal(first.data.id,retry.data.id);assert.equal(retry.status,200);
 assert.equal((await f.send(b,f.payload,key)).status,409);
 assert.equal((await f.send(a,{...f.payload,message:'Different valid content'},key)).status,409);
 for(let i=0;i<4;i++)assert.equal((await f.send(a)).status,201);
 assert.equal((await f.send(a)).status,429);assert.equal((await f.send(a,f.payload,key)).status,200);
 assert.equal((await f.send(b)).status,201);
 assert.equal((await f.call('/api/admin/feedback?page=999',{admin:true})).data.entries.length,0);
 assert.equal((await f.call('/api/admin/feedback?status=published',{admin:true})).status,400);
});

test('other feedback requires a topic, keeps it private and protects retries',async t=>{
 const f=await fixture(t),cookie=await f.guest(),body={...f.payload,category:'other',subject:'Biển chỉ dẫn khu nhà khách'},key=randomUUID();
 assert.equal((await f.send(cookie,{...body,subject:''})).status,400);
 assert.equal((await f.send(cookie,{...body,subject:'x'.repeat(121)})).status,400);
 const first=await f.send(cookie,body,key);assert.equal(first.status,201);
 assert.equal((await f.send(cookie,body,key)).status,200);
 assert.equal((await f.send(cookie,{...body,subject:'Vấn đề khác'},key)).status,409);
 const list=await f.call('/api/admin/feedback',{admin:true});assert.equal(list.data.entries[0].subject,body.subject);
 assert.equal((await f.call('/api/greetings')).data.greetings.length,0);
});
