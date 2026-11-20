import {randomUUID} from 'node:crypto';
import {participantOwner} from './participants.mjs';
export const PROGRAMS=['BCSE','ECE','MJM','OTHER'];
const DAY=86400000,dayOf=n=>Math.floor((n+7*3600000)/DAY);
export function createLibrary(db,{identity,json,readJson,fail,enabled=true,now=Date.now,admission}){
 db.exec(`CREATE TABLE IF NOT EXISTS library_profiles(owner TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,name TEXT NOT NULL,mode TEXT NOT NULL,guest_subject TEXT,program TEXT NOT NULL DEFAULT 'OTHER',sharing INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS library_books(id TEXT PRIMARY KEY,owner TEXT NOT NULL,title TEXT NOT NULL,author TEXT NOT NULL,book_key TEXT NOT NULL,status TEXT NOT NULL,position INTEGER NOT NULL,updated INTEGER NOT NULL,UNIQUE(owner,book_key));
 CREATE INDEX IF NOT EXISTS library_books_owner ON library_books(owner,position);
 CREATE TABLE IF NOT EXISTS library_sessions(owner TEXT PRIMARY KEY,id TEXT NOT NULL,book TEXT NOT NULL,last_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS library_reading(owner TEXT NOT NULL,day INTEGER NOT NULL,book TEXT NOT NULL,program TEXT NOT NULL,eligible INTEGER NOT NULL,seconds REAL NOT NULL,PRIMARY KEY(owner,day,book,program,eligible));`);
 const clean=(v,max)=>{if(typeof v!=='string'||!v.trim()||[...v].length>max||/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(v))fail(400,'FIELD','Kiểm tra tên sách, tác giả và độ dài nội dung.');return v.normalize('NFC').trim().replace(/\s+/g,' ');};
 const visible=`p.sharing=1 AND (p.mode='sso' OR (p.mode='guest' AND EXISTS(SELECT 1 FROM trial_guests g WHERE g.subject=p.guest_subject AND g.mode='guest' AND g.expires_at>${Math.floor(now())})))`;
 const books=owner=>db.prepare('SELECT id,title,author,status,position FROM library_books WHERE owner=? ORDER BY position,id').all(owner);
 function snapshot(owner){
  const profile=db.prepare('SELECT program,sharing,mode FROM library_profiles WHERE owner=?').get(owner);
  return {programs:PROGRAMS,profile:{...profile,sharing:!!profile.sharing},books:books(owner),seconds:db.prepare('SELECT coalesce(sum(seconds),0) n FROM library_reading WHERE owner=?').get(owner).n,session:db.prepare('SELECT id,book,last_at FROM library_sessions WHERE owner=?').get(owner)||null};
 }
 function community(){
  // Guests retain private shelves after expiry; their public display stops with their guest session.
  const condition=visible.replace(/g.expires_at>\d+/,`g.expires_at>${Math.floor(now())}`),since=dayOf(now())-6;
  const readers=db.prepare(`SELECT p.owner,p.public_id id,p.name,p.program,p.mode,coalesce((SELECT sum(seconds) FROM library_reading r WHERE r.owner=p.owner AND day>=?),0) seconds FROM library_profiles p WHERE ${condition} AND EXISTS(SELECT 1 FROM library_books b WHERE b.owner=p.owner) ORDER BY seconds DESC,p.public_id LIMIT 100`).all(since).map(({owner,...r})=>({...r,books:books(owner)}));
  const rankings=db.prepare(`SELECT r.program,sum(r.seconds) seconds,count(DISTINCT r.owner) readers FROM library_reading r JOIN library_profiles p ON p.owner=r.owner WHERE p.sharing=1 AND p.mode='sso' AND r.eligible=1 AND r.day>=? GROUP BY r.program ORDER BY seconds DESC,r.program`).all(since);
  const popular=db.prepare(`SELECT min(b.title) title,min(b.author) author,count(DISTINCT b.owner) readers FROM library_books b JOIN library_profiles p ON p.owner=b.owner WHERE ${condition} AND b.status='reading' GROUP BY b.book_key ORDER BY readers DESC,title LIMIT 30`).all();
  return {readers,rankings,popular};
 }
 return async(req,res,url)=>{
  if(!url.pathname.startsWith('/api/library'))return false;
  if(!enabled)fail(503,'LIBRARY_DISABLED','Thư viện đang tạm nghỉ.');
  const u=await identity(req);if(!u)fail(401,'SIGN_IN_REQUIRED','Chọn Khách hoặc SSO để vào thư viện.');const owner=participantOwner(u),mode=u.mode||'sso';
  const name=mode==='anonymous'?'Khách ẩn danh':clean(u.name||'Bạn đọc VJU',120);
  db.prepare(`INSERT INTO library_profiles(owner,public_id,name,mode,guest_subject) VALUES(?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET name=excluded.name,mode=excluded.mode,sharing=CASE WHEN excluded.mode='anonymous' THEN 0 ELSE sharing END`).run(owner,randomUUID(),name,mode,mode==='sso'?null:u.subject);
  if(req.method==='GET'&&url.pathname==='/api/library'){json(res,200,{...snapshot(owner),...community()});return true;}
  if(req.method!=='POST')fail(405,'METHOD','Phương thức không hợp lệ.');
  if(!req.headers.origin)fail(403,'ORIGIN_REQUIRED','Thiếu nguồn yêu cầu.');
  const b=await readJson(req);
  if(url.pathname==='/api/library/profile'){
   if(!PROGRAMS.includes(b.program)||typeof b.sharing!=='boolean')fail(400,'PROFILE','Chọn chương trình hợp lệ.');
   db.prepare('UPDATE library_profiles SET program=?,sharing=? WHERE owner=?').run(b.program,mode==='anonymous'?0:Number(b.sharing),owner);
  }else if(url.pathname==='/api/library/book'){
   if(typeof b.id!=='string'||!/^[-\da-f]{36}$/i.test(b.id))fail(400,'ID','Thiếu mã sách.');
   if(b.action==='remove'){
    db.prepare('DELETE FROM library_books WHERE id=? AND owner=?').run(b.id,owner);db.prepare('DELETE FROM library_sessions WHERE book=? AND owner=?').run(b.id,owner);
   }else{
    const title=clean(b.title,160),author=clean(b.author,120),key=title.toLocaleLowerCase('vi')+'|'+author.toLocaleLowerCase('vi');
    if(!['planned','reading','done'].includes(b.status))fail(400,'STATUS','Trạng thái sách không hợp lệ.');
    const prior=db.prepare('SELECT owner FROM library_books WHERE id=?').get(b.id);if(prior&&prior.owner!==owner)fail(404,'BOOK','Không tìm thấy sách.');
    if(!prior&&books(owner).length>=30)fail(409,'LIMIT','Kệ thử nghiệm tối đa 30 cuốn.');
    const duplicate=db.prepare('SELECT id FROM library_books WHERE owner=? AND book_key=?').get(owner,key);if(duplicate&&duplicate.id!==b.id)fail(409,'DUPLICATE','Cuốn sách này đã có trên kệ.');
    db.prepare(`INSERT INTO library_books VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,author=excluded.author,book_key=excluded.book_key,status=excluded.status,updated=excluded.updated`).run(b.id,owner,title,author,key,b.status,db.prepare('SELECT coalesce(max(position),-1)+1 n FROM library_books WHERE owner=?').get(owner).n,now());
    if(b.status!=='reading')db.prepare('DELETE FROM library_sessions WHERE owner=? AND book=?').run(owner,b.id);
   }
  }else if(url.pathname==='/api/library/order'){
   const ids=books(owner).map(x=>x.id);if(!Array.isArray(b.ids)||b.ids.length!==ids.length||new Set(b.ids).size!==ids.length||b.ids.some(x=>!ids.includes(x)))fail(400,'ORDER','Thứ tự sách chưa hợp lệ.');
   db.exec('BEGIN IMMEDIATE');try{b.ids.forEach((id,i)=>db.prepare('UPDATE library_books SET position=? WHERE id=? AND owner=?').run(i,id,owner));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
  }else if(url.pathname==='/api/library/read'){
   if(admission&&!admission.has(owner)){db.prepare('DELETE FROM library_sessions WHERE owner=?').run(owner);fail(409,'CAMPUS_REQUIRED','Phiên campus đã dừng. Vào lại để tiếp tục đọc.');}
   if(b.action==='start'){
    if(!db.prepare("SELECT id FROM library_books WHERE owner=? AND id=? AND status='reading'").get(owner,String(b.book)))fail(400,'BOOK','Chọn một cuốn đang đọc.');
    // Only one timed session per account, including across tabs/devices.
    db.prepare('INSERT INTO library_sessions VALUES(?,?,?,?) ON CONFLICT(owner) DO UPDATE SET id=excluded.id,book=excluded.book,last_at=excluded.last_at').run(owner,randomUUID(),b.book,now());
   }else{
    const s=db.prepare('SELECT * FROM library_sessions WHERE owner=?').get(owner);if(!s||b.lease!==s.id)fail(409,'SESSION','Phiên đọc đã dừng hoặc được mở ở nơi khác.');
    if(!['pulse','stop'].includes(b.action))fail(400,'ACTION','Thao tác không hợp lệ.');
    const elapsed=(now()-s.last_at)/1000,day=dayOf(now()),total=db.prepare('SELECT coalesce(sum(seconds),0) n FROM library_reading WHERE owner=? AND day=?').get(owner,day).n;
    // A missed/hidden heartbeat earns nothing; never trust minutes sent by a client.
    const seconds=Math.max(0,Math.min(elapsed<=30?elapsed:0,25,7200-total,(now()+7*3600000)%DAY/1000));
    const p=db.prepare('SELECT program,sharing FROM library_profiles WHERE owner=?').get(owner);
    if(seconds>0)db.prepare('INSERT INTO library_reading VALUES(?,?,?,?,?,?) ON CONFLICT(owner,day,book,program,eligible) DO UPDATE SET seconds=seconds+excluded.seconds').run(owner,day,s.book,p.program,Number(mode==='sso'&&!!p.sharing),seconds);
    if(b.action==='stop')db.prepare('DELETE FROM library_sessions WHERE owner=?').run(owner);else db.prepare('UPDATE library_sessions SET last_at=? WHERE owner=?').run(now(),owner);
   }
  }else fail(404,'NOT_FOUND','Không tìm thấy chức năng thư viện.');
  json(res,200,snapshot(owner));return true;
 };
}
