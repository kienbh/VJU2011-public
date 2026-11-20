import test from 'node:test';import assert from 'node:assert/strict';
import {emptyJournal,addJournalTime,addJournalActivity,readJournal,journalDate,journalDuration,pruneJournal} from './journalModel.ts';
const start=Date.parse('2026-11-17T10:00:00Z');
test('overlapping tab intervals are counted once; unobserved long gaps are not counted',()=>{
 const d=emptyJournal();addJournalTime(d,start,start+1500,'Hồ');addJournalTime(d,start+500,start+2000,'Hồ');
 assert.equal(d.days[journalDate(start)].areas.Hồ,2000);addJournalTime(d,start+2000,start+90000,'Hồ');
 assert.equal(d.days[journalDate(start)].areas.Hồ,2000);addJournalTime(d,start+91000,start+92000,'Hồ');
 assert.equal(d.days[journalDate(start)].areas.Hồ,3000);assert.equal(d.days[journalDate(start)].visits.length,2);
});
test('stay segments follow area changes and split at Vietnam midnight',()=>{
 const d=emptyJournal(),midnight=Date.parse('2026-11-17T17:00:00Z');
 addJournalTime(d,midnight-500,midnight+500,'Hồ');addJournalTime(d,midnight+500,midnight+1500,'Sân bóng');
 assert.equal(d.days['2026-11-17'].areas.Hồ,500);assert.equal(d.days['2026-11-18'].areas.Hồ,500);
 assert.equal(d.days['2026-11-18'].areas['Sân bóng'],1000);assert.equal(d.days['2026-11-18'].visits.length,2);
});
test('only seven dates remain; event history is bounded without losing activity totals',()=>{
 const d=emptyJournal();for(let i=0;i<10;i++)addJournalActivity(d,start+i*86400000,'football','Sân bóng');
 assert.equal(Object.keys(d.days).length,7);
 for(let i=0;i<60;i++)addJournalActivity(d,start+9*86400000+i,'feed','Hồ');
 const latest=d.days[journalDate(start+9*86400000)];assert.equal(latest.events.length,40);assert.equal(latest.activities.feed,60);
 pruneJournal(d,start+20*86400000);assert.equal(Object.keys(d.days).length,0);
});
test('reload preserves history; broken storage falls back without crashing',()=>{
 const d=emptyJournal();addJournalTime(d,start,start+1200,'Hồ');addJournalActivity(d,start+1200,'feed','Hồ');
 assert.deepEqual(readJournal(JSON.stringify(d),start+1500),d);
 for(const raw of ['{','null','{}',JSON.stringify({version:1,until:0,days:{'2026-11-17':{areas:{bad:-1},activities:{},events:[],visits:[]}}})])assert.deepEqual(readJournal(raw,start),emptyJournal());
});
test('durations stay readable with seconds, minutes and hours',()=>{
 assert.equal(journalDuration(4500),'4 giây');assert.equal(journalDuration(65000),'1 phút 5 giây');assert.equal(journalDuration(3720000),'1 giờ 2 phút');
});
