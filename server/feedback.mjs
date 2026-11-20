import {createHash,randomUUID} from 'node:crypto';
import {participantOwner} from './participants.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function createFeedback(db,{identity,admin,json,readJson,textField,fail,rate,now=Date.now}){
 db.exec(`CREATE TABLE IF NOT EXISTS campus_feedback (
 id TEXT PRIMARY KEY, owner TEXT NOT NULL, request_key TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL,
 category TEXT NOT NULL, message TEXT NOT NULL, contact TEXT NOT NULL, display_name TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','done')), created_at INTEGER NOT NULL, updated_at INTEGER);
 CREATE INDEX IF NOT EXISTS campus_feedback_status ON campus_feedback(status,created_at);
 CREATE INDEX IF NOT EXISTS campus_feedback_owner ON campus_feedback(owner,created_at);`);
 if(!db.prepare('PRAGMA table_info(campus_feedback)').all().some(c=>c.name==='subject'))db.exec("ALTER TABLE campus_feedback ADD COLUMN subject TEXT NOT NULL DEFAULT ''");
 return async(req,res,url)=>{
  const route=url.pathname,isAdmin=route==='/api/admin/feedback'||/^\/api\/admin\/feedback\/[^/]+$/.test(route);
  if(route!=='/api/feedback'&&!isAdmin)return false;
  if(isAdmin){
   admin(req,res);
   if(req.method==='GET'&&route==='/api/admin/feedback'){
    const status=url.searchParams.get('status')||'new',page=url.searchParams.get('page')||'0';
    if(!['new','done'].includes(status)||!/^\d{1,5}$/.test(page))fail(400,'INVALID_INPUT','Bộ lọc không hợp lệ.');
    const total=db.prepare('SELECT count(*) n FROM campus_feedback WHERE status=?').get(status).n;
    const entries=db.prepare('SELECT id,category,subject,message,contact,display_name AS displayName,status,created_at AS createdAt FROM campus_feedback WHERE status=? ORDER BY created_at DESC,id DESC LIMIT 25 OFFSET ?').all(status,Number(page)*25);
    json(res,200,{entries,total,page:Number(page)});return true;
   }
   if(req.method==='POST'&&route!=='/api/admin/feedback'){
    if(!req.headers.origin)fail(403,'ORIGIN_FORBIDDEN','Cần nguồn yêu cầu hợp lệ.');
    const id=route.split('/').pop(),body=await readJson(req);
    if(!UUID.test(id)||Object.keys(body).some(k=>k!=='status')||!['new','done'].includes(body.status))fail(400,'INVALID_INPUT','Trạng thái không hợp lệ.');
    if(!db.prepare('UPDATE campus_feedback SET status=?,updated_at=? WHERE id=?').run(body.status,now(),id).changes)fail(404,'NOT_FOUND','Không tìm thấy góp ý.');
    json(res,200,{ok:true});return true;
   }
   fail(405,'METHOD_NOT_ALLOWED','Phương thức không hợp lệ.');
  }
  if(req.method!=='POST')fail(405,'METHOD_NOT_ALLOWED','Góp ý chỉ dành cho ban quản trị.');
  if(!req.headers.origin)fail(403,'ORIGIN_FORBIDDEN','Cần nguồn yêu cầu hợp lệ.');
  const user=await identity(req);if(!user)fail(401,'SIGN_IN_REQUIRED','Chọn Khách hoặc đăng nhập SSO để gửi góp ý.');
  const key=req.headers['idempotency-key'];if(typeof key!=='string'||!UUID.test(key))fail(400,'IDEMPOTENCY_REQUIRED','Cần mã gửi hợp lệ.');
  const body=await readJson(req);
  if(Object.keys(body).some(k=>!['category','subject','message','contact','includeName'].includes(k))||!['bug','experience','idea','other'].includes(body.category)||typeof body.includeName!=='boolean')fail(400,'INVALID_INPUT','Góp ý không hợp lệ.');
  const subject=body.category==='other'?textField(body.subject,'Vấn đề cần góp ý',120,true):'';
  const message=textField(body.message,'Nội dung',2000,true).normalize('NFC').replace(/[\u202a-\u202e\u2066-\u2069\u200b\ufeff]/gu,'').trim();
  if([...message].length<10)fail(400,'INVALID_INPUT','Vui lòng viết từ 10 đến 2.000 ký tự.');
  const contact=textField(body.contact,'Thông tin liên hệ',120);
  const owner=participantOwner(user),fingerprint=createHash('sha256').update(JSON.stringify([body.category,message,contact,body.includeName,...(subject?[subject]:[])])).digest('hex');
  const prior=db.prepare('SELECT id,owner,fingerprint FROM campus_feedback WHERE request_key=?').get(key.toLowerCase());
  if(prior){if(prior.owner!==owner||prior.fingerprint!==fingerprint)fail(409,'IDEMPOTENCY_CONFLICT','Mã gửi đã dùng cho góp ý khác.');json(res,200,{id:prior.id,duplicate:true});return true;}
  rate(req,res,'feedback-submit',60,600000);
  if(db.prepare('SELECT count(*) n FROM campus_feedback WHERE owner=? AND created_at>?').get(owner,now()-600000).n>=5)fail(429,'RATE_LIMIT','Bạn đã gửi 5 góp ý trong 10 phút. Vui lòng thử lại sau.');
  const id=randomUUID(),name=body.includeName&&user.mode!=='anonymous'?String(user.name||'').slice(0,80):'';
  db.prepare('INSERT INTO campus_feedback(id,owner,request_key,fingerprint,category,message,contact,display_name,created_at,subject) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,owner,key.toLowerCase(),fingerprint,body.category,message,contact,name,now(),subject);
  json(res,201,{id,duplicate:false});return true;
 };
}
