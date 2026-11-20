import {createHash,randomBytes,randomUUID} from 'node:crypto';
const hash=v=>createHash('sha256').update(v).digest('hex');
export const participantOwner=u=>hash(JSON.stringify([u.issuer,u.subject]));
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(p=>p.trim().split('=')).filter(p=>p.length===2));
export function createParticipants(db,{enabled,sso,publicOrigin,devOrigin,json,readJson,textField,fail,rate,loginRateLimit=600}){
 const prefix=publicOrigin?'__Host-':'',guestName=prefix+'vju_guest',activeName=prefix+'vju_guest_active';
 const lifetime=30*86400;
 const cookie=(name,value,age)=>`${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${publicOrigin?'; Secure':''}`;
 db.exec(`CREATE TABLE IF NOT EXISTS trial_guests(token_hash TEXT PRIMARY KEY,subject TEXT NOT NULL UNIQUE,name TEXT NOT NULL,mode TEXT NOT NULL,expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS participant_submissions(greeting_id TEXT PRIMARY KEY REFERENCES greetings(id),owner TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS participant_owner ON participant_submissions(owner);`);
 const count=owner=>db.prepare('SELECT count(*) n FROM participant_submissions WHERE owner=?').get(owner).n;
 const record=(owner,id)=>db.prepare('INSERT INTO participant_submissions VALUES(?,?)').run(id,owner);
 // Retain prepared statements on the high-frequency presence path.
 const findGuest=db.prepare('SELECT subject,name,mode FROM trial_guests WHERE token_hash=? AND expires_at>?');
 async function identity(req){
  const verified=await sso.identity?.(req);if(verified)return {...verified,mode:'sso'};
  const c=cookies(req),raw=c[guestName];if(!enabled||!raw||raw.length>128||c[activeName]!=='1')return null;
  const row=findGuest.get(hash(raw),Date.now());
  return row?{issuer:'vju2011:guest',subject:row.subject,name:row.name,mode:row.mode}:null;
 }
 function writeOrigin(req){
  const allowed=publicOrigin?[publicOrigin]:[devOrigin,`http://${req.headers.host}`];
  if(!req.headers.origin||!allowed.includes(req.headers.origin))fail(403,'ORIGIN_FORBIDDEN','Nguồn yêu cầu không hợp lệ.');
 }
 const account=u=>u?{id:participantOwner(u),name:u.name,mode:u.mode,used:count(participantOwner(u)),limit:3}:null;
 async function requireUser(req){const u=await identity(req);if(!u)fail(401,'SIGN_IN_REQUIRED','Chọn Khách hoặc đăng nhập SSO VJU để gửi lời cảm ơn.');writeOrigin(req);return u;}
 function checkLimit(owner){if(count(owner)>=3)fail(409,'GARDEN_LIMIT','Bạn đã gửi đủ 3 lời cảm ơn / chậu hoa.');}
 async function route(req,res,url){
  if(!['/api/auth/session','/api/auth/guest','/api/auth/logout'].includes(url.pathname))return false;
  if(req.method==='GET'&&url.pathname==='/api/auth/session'){json(res,200,{enabled,ssoConfigured:!!sso.identity,account:account(await identity(req))});return true;}
  if(!enabled)fail(404,'NOT_FOUND','Không tìm thấy chức năng.');
  if(req.method!=='POST')fail(405,'METHOD_NOT_ALLOWED','Phương thức không hợp lệ.');
  writeOrigin(req);rate(req,res,'participant-login',loginRateLimit,600000);
  if(url.pathname==='/api/auth/guest'){
   const input=await readJson(req);if(Object.keys(input).some(k=>!['mode','name'].includes(k))||!['guest','anonymous'].includes(input.mode))fail(400,'INVALID_INPUT','Chọn cách tham gia hợp lệ.');
   const name=input.mode==='anonymous'?'Khách ẩn danh':textField(input.name,'Tên hiển thị',60,true).normalize('NFC').replace(/[\u202a-\u202e\u2066-\u2069\u200b\ufeff]/gu,'').trim();
   if(!name)fail(400,'INVALID_INPUT','Nhập tên hiển thị.');
   let token=cookies(req)[guestName];let row=token?.length<=128?db.prepare('SELECT subject FROM trial_guests WHERE token_hash=? AND expires_at>?').get(hash(token),Date.now()):null;
   if(!row){token=randomBytes(32).toString('base64url');row={subject:randomUUID()};}
   db.prepare('INSERT INTO trial_guests VALUES(?,?,?,?,?) ON CONFLICT(token_hash) DO UPDATE SET name=excluded.name,mode=excluded.mode,expires_at=excluded.expires_at').run(hash(token),row.subject,name,input.mode,Date.now()+lifetime*1000);
   if(input.mode==='anonymous'&&db.prepare("SELECT name FROM sqlite_master WHERE name='library_profiles'").get())db.prepare('UPDATE library_profiles SET sharing=0 WHERE guest_subject=?').run(row.subject);
   sso.clear?.(req);
   res.setHeader('Set-Cookie',[cookie(guestName,token,lifetime),cookie(activeName,'1',lifetime),cookie(prefix+'vju_session','',0)]);
   json(res,200,{account:account({issuer:'vju2011:guest',subject:row.subject,name,mode:input.mode})});return true;
  }
  if(url.pathname==='/api/auth/logout'){
   sso.clear?.(req);res.setHeader('Set-Cookie',[cookie(activeName,'',0),cookie(prefix+'vju_session','',0)]);json(res,200,{ok:true});return true;
  }
  fail(405,'METHOD_NOT_ALLOWED','Phương thức không hợp lệ.');
 }
 return {identity,route,requireUser,account,count,record,checkLimit};
}
