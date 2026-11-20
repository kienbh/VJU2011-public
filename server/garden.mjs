import {createHash,randomBytes,randomUUID} from 'node:crypto';

const KINDS=['rose','daisy','sunflower','cosmos','lavender','tulip','lotus','chrysanthemum','bidens'];
const digest=value=>createHash('sha256').update(value).digest('hex');
/** Identity must come from a server-verified SSO adapter, never a browser user ID or email. */
export function createGarden(db,{json,readJson,textField,fail,rate,event,identity=null,participants=null,ssoConfigured=!!identity}){
 db.exec(`CREATE TABLE IF NOT EXISTS garden_pots (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT NOT NULL, request_key TEXT NOT NULL, fingerprint TEXT NOT NULL,
  greeting_id TEXT NOT NULL UNIQUE REFERENCES greetings(id),
  UNIQUE(owner,request_key));
 CREATE INDEX IF NOT EXISTS garden_owner ON garden_pots(owner);`);
 if(participants)db.exec('INSERT OR IGNORE INTO participant_submissions(greeting_id,owner) SELECT greeting_id,owner FROM garden_pots');
 const join='SELECT p.sequence,p.owner,g.* FROM garden_pots p JOIN greetings g ON g.id=p.greeting_id';
 const card=r=>({id:r.id,sequence:r.sequence,page:Math.floor((r.sequence-1)/24),slot:(r.sequence-1)%24,
  flowers:JSON.parse(r.bouquet_json),plantedAt:Date.parse(r.created_at),operationId:r.id,
  signature:r.signature,recipient:r.recipient_name,message:r.message,status:r.status});
 async function user(req){
  const u=identity?await identity(req):null;
  if(!u)return null;
  if(typeof u.issuer!=='string'||!u.issuer||typeof u.subject!=='string'||!u.subject)throw Error('Invalid verified SSO identity');
  return {owner:digest(JSON.stringify([u.issuer,u.subject])),name:typeof u.name==='string'?u.name.slice(0,80):'Thành viên VJU',mode:u.mode||'sso'};
 }
 return async(req,res,url)=>{
  if(!url.pathname.startsWith('/api/garden'))return false;
  const me=await user(req);
  if(req.method==='GET'&&url.pathname==='/api/garden'){
   const raw=url.searchParams.get('page')||'0';if(!/^(0|[1-9][0-9]{0,8})$/.test(raw))fail(400,'INVALID_PAGE','Trang vườn không hợp lệ.');
   const last=db.prepare('SELECT COALESCE(MAX(sequence),0) n FROM garden_pots').get().n;
   const pages=Math.max(1,Math.ceil(last/24)),page=Math.min(Number(raw),pages-1);
   const total=db.prepare('SELECT count(*) n FROM garden_pots').get().n;
   const published=db.prepare("SELECT count(*) n FROM garden_pots p JOIN greetings g ON g.id=p.greeting_id WHERE g.status='approved' AND g.visibility='public'").get().n;
   const rows=db.prepare(join+' WHERE p.sequence BETWEEN ? AND ? ORDER BY p.sequence').all(page*24+1,(page+1)*24);
   const slots=Array(24).fill(null);
   for(const r of rows)if(r.status==='approved'&&r.visibility==='public')slots[(r.sequence-1)%24]={...card(r),mine:r.owner===me?.owner};
   const mine=me?db.prepare(join+' WHERE p.owner=? ORDER BY p.sequence').all(me.owner).map(card):[];
   json(res,200,{page,pages,total,published,slots,mine,account:me?{id:me.owner,name:me.name,mode:me.mode,used:participants?participants.count(me.owner):mine.length,limit:3}:null,ssoConfigured,autoApprove:event().autoApprove,acceptingSubmissions:event().acceptingSubmissions});return true;
  }
  if(req.method==='POST'&&url.pathname==='/api/garden/pots'){
   rate(req,res,'garden-submit',30,600000);
   if(!identity)fail(503,'SSO_UNAVAILABLE','Đang chờ kết nối tài khoản VJU/SSO. Bó hoa của bạn được giữ lại.');
   if(!me)fail(401,'SIGN_IN_REQUIRED','Đăng nhập VJU để cắm hoa.');
   // Cookie-authenticated writes must carry a browser Origin; the outer router validates it.
   if(!req.headers.origin)fail(403,'ORIGIN_REQUIRED','Thiếu nguồn yêu cầu.');
   const key=req.headers['idempotency-key'];if(typeof key!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(key))fail(400,'IDEMPOTENCY_REQUIRED','Cần mã gửi duy nhất.');
   const input=await readJson(req);
   if(Object.keys(input).some(k=>!['flowers','signature','recipient','message'].includes(k)))fail(400,'INVALID_INPUT','Dữ liệu không hợp lệ.');
   if(!Array.isArray(input.flowers)||input.flowers.length<1||input.flowers.length>5||input.flowers.some(k=>!KINDS.includes(k)))fail(400,'INVALID_FLOWERS','Chọn từ 1 đến 5 bông hoa.');
   const clean=(v,label,max)=>textField(v,label,max,true).normalize('NFC').replace(/[\u202a-\u202e\u2066-\u2069\u200b\ufeff]/gu,'').trim();
   const payload={flowers:input.flowers,signature:clean(input.signature,'Tên ghi trên chậu',60),recipient:clean(input.recipient,'Người nhận',60),message:clean(input.message,'Lời cảm ơn',240)};
   if(me.mode==='anonymous')payload.signature='Khách ẩn danh';
   if([...payload.message].length<10||!payload.signature||!payload.recipient)fail(400,'INVALID_INPUT','Lời cảm ơn cần ít nhất 10 ký tự và đủ tên người gửi, người nhận.');
   const fingerprint=digest(JSON.stringify(payload));
   // No awaits within the transaction. The database serializes requests across tabs/processes.
   db.exec('BEGIN IMMEDIATE');let result,duplicate=false;
   try{
    const prior=db.prepare(join+' WHERE p.owner=? AND p.request_key=?').get(me.owner,key.toLowerCase());
    if(prior){if(prior.payload_hash!==fingerprint)fail(409,'IDEMPOTENCY_CONFLICT','Mã gửi đã dùng cho nội dung khác.');result=card(prior);duplicate=true;}
    else{
     if(!event().acceptingSubmissions)fail(403,'EVENT_CLOSED','Hiện tạm ngừng nhận lời cảm ơn.');
     if(participants)participants.checkLimit(me.owner);
     if(db.prepare('SELECT count(*) n FROM garden_pots WHERE owner=?').get(me.owner).n>=3)fail(409,'GARDEN_LIMIT','Tài khoản đã gửi đủ 3 chậu hoa / 3 lời cảm ơn.');
     const id=randomUUID(),status=event().autoApprove?'approved':'pending',createdAt=new Date().toISOString();
     db.prepare(`INSERT INTO greetings(id,payload_hash,receipt_token,recipient_id,recipient_name,message,signature,class_name,visibility,gift,status,created_at,is_sample,bouquet_json,moderated_at)
      VALUES(?,?,?,?,?,?,?,?,'public','flowers',?,?,0,?,?)`).run(id,fingerprint,randomBytes(32).toString('base64url'),'general',payload.recipient,payload.message,payload.signature,'',status,createdAt,JSON.stringify(payload.flowers),status==='approved'?createdAt:null);
     db.prepare('INSERT INTO garden_pots(owner,request_key,fingerprint,greeting_id) VALUES(?,?,?,?)').run(me.owner,key.toLowerCase(),fingerprint,id);
     if(participants)participants.record(me.owner,id);
     result=card(db.prepare(join+' WHERE g.id=?').get(id));
    }
    db.exec('COMMIT');
   }catch(error){db.exec('ROLLBACK');throw error;}
   json(res,duplicate?200:201,{pot:result,duplicate});return true;
  }
  fail(404,'NOT_FOUND','Không tìm thấy API vườn hoa.');
 };
}
