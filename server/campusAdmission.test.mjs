import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampusAdmission} from './campusAdmission.mjs';
function fixture(options={}){let time=1000;const released=[],a=createCampusAdmission({...options,now:()=>time,onRelease:id=>released.push(id)});return {a,released,tick:ms=>time+=ms};}
test('50 places, FIFO offers, bounded queue, and multiple tabs use one place',()=>{
 const {a}=fixture({queueLimit:2});for(let i=0;i<50;i++)assert.equal(a.enter('p'+i,'tab').state,'admitted');
 assert.equal(a.enter('p0','second').online,50);
 assert.equal(a.enter('q1','tab').position,1);assert.equal(a.enter('q2','tab').position,2);assert.equal(a.enter('q3','tab').reason,'full');
 a.leave('p0','tab');assert.equal(a.poll('q1','tab').state,'queued');a.leave('p0','second');
 assert.equal(a.poll('q1','tab').state,'offered');assert.equal(a.poll('q2','tab').position,1);
 assert.equal(a.enter('q1','tab').state,'admitted');assert.equal(a.count(),50);
});
test('server evicts after 5 minutes even with heartbeats; activity in either tab retains place',()=>{
 const {a,tick,released}=fixture();a.enter('idle','t');a.enter('active','t');a.enter('active','second');
 for(let i=1;i<=60;i++){tick(5000);a.pulse('idle','t',0);a.pulse('active','t',0);a.pulse('active','second',i);}
 assert.equal(a.status('idle','t').reason,'idle');assert.equal(a.count(),1);assert.deepEqual(released,['idle']);
 assert.equal(a.pulse('idle','t',100).reason,'idle','heartbeat cannot silently rejoin');
 assert.equal(a.enter('idle','t',101).state,'admitted');
});
test('missed offer after 60s goes to next; pending offers cannot be stolen by newcomers',()=>{
 const {a,tick}=fixture({capacity:1});a.enter('first','t');a.enter('q1','t');a.enter('q2','t');a.leave('first','t');
 assert.equal(a.enter('new','t').position,2);
 for(let i=0;i<5;i++){tick(10000);a.poll('q1','t');a.poll('q2','t');a.poll('new','t');}
 tick(10000);assert.equal(a.poll('q1','t').reason,'missed');assert.equal(a.poll('q2','t').state,'offered');assert.equal(a.poll('new','t').position,1);
});
test('disconnect expires leases and restart starts empty without persisting activity',()=>{
 const {a,tick,released}=fixture({capacity:1});a.enter('a','one');a.enter('a','two');a.enter('b','t');tick(30000);a.poll('b','t');a.pulse('a','two',0);tick(15001);
 assert.equal(a.poll('b','t').state,'queued');tick(30000);assert.equal(a.poll('b','t').state,'offered');assert.deepEqual(released,['a']);
 assert.equal(createCampusAdmission().pulse('a','two',0).reason,'missing');
});
