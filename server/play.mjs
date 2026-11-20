import {randomUUID,createHash} from 'node:crypto';
import {participantOwner} from './participants.mjs';
import {RUBBISH,greenConfig,greenItems,greenUnlockSeconds} from './greenRules.mjs';
export {RUBBISH} from './greenRules.mjs';
export function createPlay(db,{identity,fail,json,readJson,enabled=true,admin,now=Date.now,admission}){
 db.exec(`CREATE TABLE IF NOT EXISTS play_runs(id TEXT PRIMARY KEY,owner TEXT NOT NULL,kind TEXT NOT NULL,state TEXT NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS play_owner ON play_runs(owner,kind,updated);
 CREATE TABLE IF NOT EXISTS play_requests(owner TEXT NOT NULL,key TEXT NOT NULL,hash TEXT NOT NULL,response TEXT NOT NULL,PRIMARY KEY(owner,key));
 CREATE TABLE IF NOT EXISTS play_collection(owner TEXT NOT NULL,item TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(owner,item));
 CREATE TABLE IF NOT EXISTS play_profile(owner TEXT PRIMARY KEY,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS play_content(id TEXT PRIMARY KEY,data TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft');`);
 const draft=[['silver-lining','Every cloud has a silver lining.','Trong khó khăn vẫn có thể tìm thấy điều tích cực.'],['step','One step at a time.','Làm từng bước một.'],['practice','Practice makes perfect.','Luyện tập giúp ta tiến bộ.'],['learn','Learn from your mistakes.','Rút kinh nghiệm từ điều chưa làm tốt.'],['ask','Ask for help.','Tìm sự hỗ trợ khi cần.'],['begin','A fresh start.','Một khởi đầu mới.'],['team','Two heads are better than one.','Cùng suy nghĩ có thể tìm được cách tốt hơn.'],['time','Rome was not built in a day.','Việc lớn cần thời gian.'],['effort','Go the extra mile.','Cố gắng thêm một bước.'],['open','Keep an open mind.','Sẵn sàng xem xét ý tưởng mới.'],['balance','Take a break.','Cho mình một khoảng nghỉ.'],['action','Actions speak louder than words.','Hành động thể hiện điều lời nói chưa đủ.']];
 for(const [id,text,meaning] of draft)db.prepare('INSERT OR IGNORE INTO play_content(id,data) VALUES(?,?)').run(id,JSON.stringify({text,meaning,type:'Bản biên tập chờ kiểm tra loại thành ngữ/tục ngữ',source:'',example:'',action:''}));
 const award=(owner,item)=>db.prepare('INSERT OR IGNORE INTO play_collection VALUES(?,?,?)').run(owner,item,now());
 const progress=owner=>({collection:db.prepare('SELECT item,created FROM play_collection WHERE owner=? ORDER BY created').all(owner),profile:JSON.parse(db.prepare('SELECT data FROM play_profile WHERE owner=?').get(owner)?.data||'{"favorites":[],"decor":"none"}'),runs:db.prepare('SELECT id,kind,state,created FROM play_runs WHERE owner=? AND updated>? ORDER BY updated DESC LIMIT 10').all(owner,now()-1800000).map(r=>({id:r.id,kind:r.kind,state:JSON.parse(r.state),elapsedMs:Math.max(0,now()-r.created)})),content:db.prepare("SELECT id,data FROM play_content WHERE status='approved'").all().map(r=>({id:r.id,...JSON.parse(r.data)})),community:db.prepare("SELECT count(*) n FROM play_collection WHERE item='green-first'").get().n});
 return async function(req,res,url){
  if(!url.pathname.startsWith('/api/play'))return false;
  if(!enabled)fail(503,'PLAY_DISABLED','Khu trải nghiệm đang tạm nghỉ.');
  if(url.pathname==='/api/play/admin/content'){
   admin(req,res);if(req.method==='GET'){json(res,200,{items:db.prepare('SELECT * FROM play_content').all().map(r=>({...r,data:JSON.parse(r.data)}))});return true;}
   if(req.method!=='POST')fail(405,'METHOD','Phương thức không hợp lệ.');
   const b=await readJson(req);if(!['draft','approved'].includes(b.status)||!db.prepare('SELECT id FROM play_content WHERE id=?').get(String(b.id)))fail(400,'CONTENT','Mục không hợp lệ.');
   const d=b.data;if(!d||['text','meaning','type','source','example','action'].some(k=>typeof d[k]!=='string'||d[k].length>1000))fail(400,'CONTENT','Điền đủ câu, nghĩa, loại, nguồn, ví dụ và hành động.');
   if(b.status==='approved'&&['text','meaning','type','source','example','action'].some(k=>!d[k].trim()))fail(400,'CONTENT','Nội dung công khai cần nguồn và ví dụ đã duyệt.');
   db.prepare('UPDATE play_content SET data=?,status=? WHERE id=?').run(JSON.stringify(d),b.status,b.id);json(res,200,{ok:true});return true;
  }
  const user=await identity(req);if(!user)fail(401,'SIGN_IN_REQUIRED','Chọn Khách hoặc SSO để lưu trải nghiệm.');const owner=participantOwner(user);
  if(req.method==='GET'&&url.pathname==='/api/play/progress'){json(res,200,progress(owner));return true;}
  if(req.method!=='POST')fail(405,'METHOD','Phương thức không hợp lệ.');
  if(!req.headers.origin)fail(403,'ORIGIN_REQUIRED','Thiếu nguồn yêu cầu.');
  if(admission&&!admission.has(owner))fail(409,'CAMPUS_REQUIRED','Vào campus trước khi chơi.');
  const b=await readJson(req),key=req.headers['idempotency-key'];if(typeof key!=='string'||!/^[-\da-f]{36}$/i.test(key))fail(400,'KEY_REQUIRED','Thiếu mã thao tác.');
  const fingerprint=createHash('sha256').update(url.pathname+JSON.stringify(b)).digest('hex');
  db.exec('BEGIN IMMEDIATE');let result;
  try{
   const prior=db.prepare('SELECT * FROM play_requests WHERE owner=? AND key=?').get(owner,key);
   if(prior){if(prior.hash!==fingerprint)fail(409,'REPLAY_CONFLICT','Mã thao tác đã dùng.');result=JSON.parse(prior.response);}
   else{
    if(url.pathname==='/api/play/profile'){
     const places=['plaza','green','library','club','campfire','fish','tea','sakura','lotus','hotel','football','gate','board','flowers','plant','reflection','stage','feedback'];
     if(!Array.isArray(b.favorites)||b.favorites.length>places.length||b.favorites.some(id=>!places.includes(id))||!['none','label','pot','model'].includes(b.decor))fail(400,'PROFILE','Lựa chọn không hợp lệ.');
     const items=progress(owner).collection.map(x=>x.item),required={label:'green-first',pot:'green-perfect',model:'fish-3'};
     if(b.decor!=='none'&&!items.includes(required[b.decor]))fail(403,'LOCKED','Chưa mở đồ trang trí này.');
     db.prepare('INSERT INTO play_profile VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET data=excluded.data').run(owner,JSON.stringify({favorites:[...new Set(b.favorites)],decor:b.decor}));result={ok:true};
    }else if(url.pathname==='/api/play/start'){
     if(!['green','fish','football'].includes(b.kind))fail(400,'KIND','Hoạt động không hợp lệ.');
     const old=db.prepare('SELECT * FROM play_runs WHERE owner=? AND kind=? AND updated>? ORDER BY updated DESC LIMIT 1').get(owner,b.kind,now()-1800000);
     if(old&&!JSON.parse(old.state).done)result={id:old.id,kind:old.kind,state:JSON.parse(old.state)};
     else{
      const id=randomUUID(),state=b.kind==='green'?{...(b.version===2?{version:2,seed:parseInt(id.slice(0,8),16)}:{}),picked:[],sorted:[],mistakes:0,done:false}:b.kind==='fish'?{phase:'ready',caught:0,done:false}:{shots:0,hits:0,done:false};
      db.prepare('INSERT INTO play_runs VALUES(?,?,?,?,?,?)').run(id,owner,b.kind,JSON.stringify(state),now(),now());result={id,kind:b.kind,state};
     }
    }else if(url.pathname==='/api/play/event'){
     const r=db.prepare('SELECT * FROM play_runs WHERE id=? AND owner=?').get(String(b.run),owner);if(!r||r.updated<now()-1800000)fail(409,'EXPIRED','Lượt đã hết hạn. Hãy bắt đầu lượt mới.');
     const s=JSON.parse(r.state);if(s.done)fail(409,'FINISHED','Lượt này đã hoàn tất.');
     if(b.action==='finish'){s.done=true;}
     else if(r.kind==='green'){
      const n=b.item,config=greenConfig(s);if(!Number.isInteger(n)||n<0||n>=config.total)fail(400,'ITEM','Vật không hợp lệ.');
      if(b.action==='pick'){
       if(s.picked.includes(n))fail(409,'PICKED','Đã nhặt vật này.');
       if(now()-r.created<greenUnlockSeconds(s,n)*1000)fail(409,'EARLY','Vật chưa xuất hiện.');
       if(s.picked.length-s.sorted.length>=6)fail(409,'BAG_FULL','Túi đủ 6 món. Hãy tới trạm phân loại.');s.picked.push(n);
      }else if(b.action==='sort'){
       if(!s.picked.includes(n)||s.sorted.includes(n))fail(409,'NOT_IN_BAG','Vật không có trong túi.');
       if(!['organic','recycle','residual'].includes(b.bin))fail(400,'BIN','Nhóm không hợp lệ.');
       if(b.bin===RUBBISH[greenItems(s)[n]].bin){s.sorted.push(n);s.feedback='Đúng rồi. '+RUBBISH[greenItems(s)[n]].why;}else{s.mistakes++;s.feedback='Thử lại nhé. '+RUBBISH[greenItems(s)[n]].why;}
       if(s.sorted.length>=6)award(owner,'green-first');if(s.sorted.length>=6&&!s.mistakes)award(owner,'green-perfect');if(s.sorted.length===config.total)s.done=true;
      }else fail(400,'ACTION','Thao tác không hợp lệ.');
     }else if(r.kind==='fish'){
      if(b.action==='cast'){
       if(s.phase==='waiting')fail(409,'CAST','Đang chờ cá.');s.phase='waiting';s.biteAt=now()+3000+Math.floor(Math.random()*4000);
      }else if(b.action==='reel'){
       if(s.phase!=='waiting')fail(409,'CAST','Hãy thả câu trước.');
       const assisted=b.assisted===true,delta=now()-s.biteAt;s.phase='ready';
       s.success=delta>=0&&(assisted||delta<3200);
       if(s.success){s.caught++;const have=db.prepare("SELECT count(*) n FROM play_collection WHERE owner=? AND item LIKE 'fish-%' AND item<>'fish-3'").get(owner).n;
        s.fish=['fish-carp','fish-silver','fish-gold'][have%3];award(owner,s.fish);if(have>=2)award(owner,'fish-3');
        const content=db.prepare("SELECT id FROM play_content WHERE status='approved' AND ('thought-'||id) NOT IN (SELECT item FROM play_collection WHERE owner=?) ORDER BY id LIMIT 1").get(owner);s.thought=content?.id||null;if(content)award(owner,'thought-'+content.id);
       }
      }else fail(400,'ACTION','Thao tác không hợp lệ.');
     }else if(r.kind==='football'){
      if(b.action!=='shot'||(s.shots>0&&now()-r.updated<4200)||!Number.isFinite(b.aim))fail(400,'SHOT','Chờ bóng trở lại trước khi sút.');
      const target=[.25,.7,.45,.8,.3][s.shots];s.shots++;s.hit=Math.abs(b.aim-target)<.13;if(s.hit)s.hits++;if(s.shots===5){s.done=true;award(owner,'football-'+s.hits);}
     }
     db.prepare('UPDATE play_runs SET state=?,updated=? WHERE id=?').run(JSON.stringify(s),now(),r.id);result={id:r.id,kind:r.kind,state:s};
    }else fail(404,'NOT_FOUND','Không tìm thấy hoạt động.');
    db.prepare('INSERT INTO play_requests VALUES(?,?,?,?)').run(owner,key,fingerprint,JSON.stringify(result));
   }
   db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  json(res,200,result);return true;
 };
}
