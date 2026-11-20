import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {createLibrary} from './library.mjs';
function fixture(t){const db=new DatabaseSync(':memory:');let time=Date.UTC(2026,10,16,6);db.exec('CREATE TABLE trial_guests(subject TEXT,mode TEXT,expires_at INTEGER)');
 const route=createLibrary(db,{identity:async r=>r.user?{issuer:'qa',subject:r.user,name:'Reader '+r.user,mode:r.mode}:null,now:()=>time,readJson:async r=>r.body,json:(r,status,body)=>Object.assign(r,{status,body}),fail:(status,code)=>{throw Object.assign(Error(code),{status,code});}});t.after(()=>db.close());
 return {db,advance:n=>time+=n,async api(path='',body,{user='a',mode='sso',origin=true}={}){const res={};try{await route({user,mode,method:body?'POST':'GET',headers:origin?{origin:'http://test'}:{},body},res,new URL('http://test/api/library'+path));}catch(e){return {status:e.status,code:e.code};}return res;}};}
const book=(title='Book A')=>({id:randomUUID(),title,author:'Author A',status:'reading'});
test('library auth, private defaults, validation, duplicate retry and owner isolation',async t=>{
 const f=fixture(t),b=book();assert.equal((await f.api('',null,{user:null})).status,401);assert.equal((await f.api('/book',b,{origin:false})).status,403);
 assert.equal((await f.api()).body.profile.sharing,false);assert.equal((await f.api('/book',b)).status,200);assert.equal((await f.api('/book',b)).body.books.length,1);
 assert.equal((await f.api('/book',{...b,id:randomUUID()})).code,'DUPLICATE');assert.equal((await f.api('/book',b,{user:'b'})).status,404);
 assert.equal((await f.api('/book',{...book(),title:'Bad\u202e'})).code,'FIELD');assert.equal((await f.api('/profile',{program:'FAKE',sharing:true})).status,400);
 assert.equal((await f.api('',null,{user:'b'})).body.readers.length,0);
});
test('library shelf order, popular books, opt-in and immediate opt-out',async t=>{
 const f=fixture(t),a=book(),b=book('Book B');await f.api('/book',a);await f.api('/book',b);
 assert.equal((await f.api('/order',{ids:[b.id,a.id]})).body.books[0].id,b.id);assert.equal((await f.api('/order',{ids:[a.id,a.id]})).status,400);
 await f.api('/profile',{program:'BCSE',sharing:true});let d=(await f.api('',null,{user:'b'})).body;assert.equal(d.readers[0].books[0].title,'Book B');assert(!('owner' in d.readers[0]));assert.equal(d.popular.length,2);
 await f.api('/book',{...book(),title:'Book A'},{user:'b'});await f.api('/profile',{program:'ECE',sharing:true},{user:'b'});d=(await f.api()).body;assert.equal(d.popular[0].readers,2);
 await f.api('/profile',{program:'BCSE',sharing:false});assert.equal((await f.api('',null,{user:'b'})).body.readers.length,1);
});
test('library time is server-derived, nonduplicating, single-lease, capped and hidden gaps earn nothing',async t=>{
 const f=fixture(t),b=book();await f.api('/book',b);await f.api('/profile',{program:'BCSE',sharing:true});let s=(await f.api('/read',{action:'start',book:b.id})).body.session;
 f.advance(15000);assert.equal((await f.api('/read',{action:'pulse',lease:s.id,seconds:999999})).body.seconds,15);assert.equal((await f.api('/read',{action:'pulse',lease:s.id})).body.seconds,15);
 f.advance(60000);assert.equal((await f.api('/read',{action:'pulse',lease:s.id})).body.seconds,15);
 const next=(await f.api('/read',{action:'start',book:b.id})).body.session;assert.equal((await f.api('/read',{action:'pulse',lease:s.id})).code,'SESSION');s=next;
 for(let i=0;i<500;i++){f.advance(15000);await f.api('/read',{action:'pulse',lease:s.id});}
 const d=(await f.api()).body;assert.equal(d.seconds,7200);assert.equal(d.rankings[0].program,'BCSE');assert.equal(d.rankings[0].readers,1);
 await f.api('/read',{action:'stop',lease:s.id});assert.equal((await f.api()).body.session,null);f.advance(8*86400000);assert.equal((await f.api()).body.rankings.length,0);
});
test('anonymous stays private, guests never enter program ranking and expired guests disappear',async t=>{
 const f=fixture(t),b=book();f.db.prepare('INSERT INTO trial_guests VALUES(?,?,?)').run('a','guest',Date.UTC(2026,10,17));
 const guest={mode:'guest'};await f.api('/book',b,guest);await f.api('/profile',{program:'MJM',sharing:true},guest);const s=(await f.api('/read',{action:'start',book:b.id},guest)).body.session;f.advance(15000);await f.api('/read',{action:'pulse',lease:s.id},guest);
 let d=(await f.api('',null,guest)).body;assert.equal(d.seconds,15);assert.equal(d.rankings.length,0);assert.equal(d.readers.length,1);
 f.db.exec("UPDATE trial_guests SET mode='anonymous'");assert.equal((await f.api('',null,{user:'b'})).body.readers.length,0);
 assert.equal((await f.api('/profile',{program:'MJM',sharing:true},{mode:'anonymous'})).body.profile.sharing,false);
 f.db.exec("UPDATE trial_guests SET mode='guest',expires_at=0");await f.api('/profile',{program:'MJM',sharing:true},guest);assert.equal((await f.api('',null,guest)).body.readers.length,0);
});
test('book status/removal stops session, daily boundary and unshared credit do not leak into rank',async t=>{
 const f=fixture(t),b=book();await f.api('/book',b);let s=(await f.api('/read',{action:'start',book:b.id})).body.session;f.advance(15000);await f.api('/read',{action:'pulse',lease:s.id});await f.api('/profile',{program:'ECE',sharing:true});assert.equal((await f.api()).body.rankings.length,0);
 await f.api('/book',{...b,status:'done'});assert.equal((await f.api('/read',{action:'pulse',lease:s.id})).status,409);
 await f.api('/book',{action:'remove',id:b.id});assert.equal((await f.api()).body.books.length,0);
});
test('Vietnam midnight clips credit to the new day and programme changes do not move old credit',async t=>{
 const f=fixture(t),b=book();await f.api('/book',b);await f.api('/profile',{program:'BCSE',sharing:true});
 f.advance(11*3600000-500);const s=(await f.api('/read',{action:'start',book:b.id})).body.session;f.advance(1000);
 assert.equal((await f.api('/read',{action:'pulse',lease:s.id})).body.seconds,.5);await f.api('/profile',{program:'ECE',sharing:true});f.advance(15000);await f.api('/read',{action:'pulse',lease:s.id});
 const ranks=(await f.api()).body.rankings;assert.equal(ranks.find(r=>r.program==='BCSE').seconds,.5);assert.equal(ranks.find(r=>r.program==='ECE').seconds,15);
});
