import {migrateCoffeeGift} from './giftSchema.mjs';
import {createFeedback} from './feedback.mjs';
import {moderationRole} from './moderationRoles.mjs';
import {createCampusAdmission,campusRoute} from './campusAdmission.mjs';
import {clientAddress} from './rateIdentity.mjs';
import {createPlay} from './play.mjs';
import {createTeaRoom} from './tea.mjs';
import {createLibrary} from './library.mjs';
import {createPresence} from './presence.mjs';
import {createDiagnostics} from './diagnostics.mjs';
import {createReflections} from './reflections.mjs';
import {createGarden} from './garden.mjs';
import {createSso} from './sso.mjs';
import {createParticipants,participantOwner} from './participants.mjs';
import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID,timingSafeEqual,createHash} from 'node:crypto';
import {mkdirSync,readFileSync,statSync,realpathSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const LIMITS=Object.freeze({message:1000,signature:80,className:80,jsonBytes:32768});
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const DEFAULT_EVENT={name:'VJU2011 · Lễ hội tri ân',date:'2026-11-20',timeZone:'Asia/Ho_Chi_Minh',mode:'rehearsal',acceptingSubmissions:true,autoApprove:true,effectsEnabled:true,closingAt:null};
const GENERAL={id:'general',name:'Tập thể thầy cô và cán bộ nhân viên VJU'};
class ApiError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}
const fail=(status,code,message)=>{throw new ApiError(status,code,message);};
const constantEqual=(a,b)=>{const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));return aa.length===bb.length&&timingSafeEqual(aa,bb);};
const bearer=req=>/^Bearer ([A-Za-z0-9_-]+)$/.exec(req.headers.authorization||'')?.[1]||'';
const hash=value=>createHash('sha256').update(value).digest('hex');
function json(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(payload));}
function readJson(req){
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))fail(415,'JSON_REQUIRED','Yêu cầu dữ liệu JSON.');
 if(Number(req.headers['content-length'])>LIMITS.jsonBytes)fail(413,'BODY_TOO_LARGE','Nội dung gửi quá lớn.');
 return new Promise((resolve,reject)=>{let size=0,chunks=[],failed=false;
  req.on('data',chunk=>{size+=chunk.length;if(size>LIMITS.jsonBytes){if(!failed){failed=true;chunks=[];reject(new ApiError(413,'BODY_TOO_LARGE','Nội dung gửi quá lớn.'));}return;}if(!failed)chunks.push(chunk);});
  req.on('end',()=>{if(failed)return;try{const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();resolve(value);}catch{reject(new ApiError(400,'INVALID_JSON','Dữ liệu JSON không hợp lệ.'));}});
  req.on('error',reject);
 });
}
/** Japanese is dense: Japanese text needs 5 characters, everything else 10 (mirrors src/i18n minMessageLength). */
export function minMessageLength(text){return /[\u3040-\u30ff\u3400-\u9fff]/u.test(text)?5:10;}
function textField(value,name,max,required=false){
 if(value===undefined&&!required)return '';
 if(typeof value!=='string')fail(400,'INVALID_INPUT',`${name} phải là văn bản.`);
 const trimmed=value.trim();
 if((required&&!trimmed)||[...trimmed].length>max||/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(trimmed))fail(400,'INVALID_INPUT',`${name} cần ${required?'1–':'không quá '}${max} ký tự hợp lệ.`);
 return trimmed;
}
const publicCard=row=>({id:row.id,message:row.message,signature:row.signature,className:row.class_name,gift:row.gift,recipientName:row.recipient_name,createdAt:row.created_at,isSample:!!row.is_sample,...(row.book_json?JSON.parse(row.book_json):{}),...(row.bouquet_json?{bouquet:JSON.parse(row.bouquet_json)}:{})});
const adminCard=row=>({...publicCard(row),recipientId:row.recipient_id,visibility:row.visibility,status:row.status,moderatedAt:row.moderated_at,...(row.garden_sequence?{garden:{sequence:row.garden_sequence,page:Math.floor((row.garden_sequence-1)/24),slot:(row.garden_sequence-1)%24}}:{})});

/** Standard http.Server; caller controls listen/close. Local rehearsal only. */
export function createAppServer({dbPath=path.join(ROOT,'.local/vju2011.sqlite'),adminToken,staticRoot=path.join(ROOT,'dist'),recipients=[],submissionRateLimit=30,readRateLimit=12000,publicOrigin=null,devOrigin=null,submissionsEnabled=true,seedSamples=true,publicOnly=false,releaseSha='development',logger,gardenIdentity=null,ssoConfig=null,trialAccounts=false,playEnabled=true,moderationGrants=()=>[],campusCapacity=50,campusQueueLimit=200,campusIdleMs=300000,campusNow=Date.now,writeRateLimit=120,globalWriteRateLimit=6000,loginRateLimit=600,trustedClientIpHeader=''}={}){
 if(publicOrigin!==null){const u=new URL(publicOrigin);if(u.protocol!=='https:'||u.origin!==publicOrigin||u.username||u.password)throw Error('publicOrigin must be an exact HTTPS origin without a path.');}
 if(devOrigin!==null){const u=new URL(devOrigin);if(u.origin!==devOrigin||u.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(u.hostname))throw Error('devOrigin must be an exact loopback HTTP origin.');}
 for(const n of [submissionRateLimit,readRateLimit,writeRateLimit,globalWriteRateLimit,loginRateLimit,campusCapacity,campusQueueLimit,campusIdleMs])if(!Number.isSafeInteger(n)||n<1)throw Error('Limits must be positive integers.');
 if(!['','cf-connecting-ip','x-real-ip'].includes(trustedClientIpHeader))throw Error('Unsupported trusted IP header.');
 for(const v of [submissionsEnabled,seedSamples,publicOnly])if(typeof v!=='boolean')throw Error('Runtime switches must be booleans.');
 if(releaseSha!=='development'&&!/^[a-f0-9]{40}$/.test(releaseSha))throw Error('releaseSha must be a full Git SHA.');
 if(typeof adminToken!=='string'||adminToken.length<32||!/^[A-Za-z0-9_-]+$/.test(adminToken))throw Error('A strong URL-safe adminToken (32+ characters) is required.');
 if(dbPath!==':memory:')mkdirSync(path.dirname(path.resolve(dbPath)),{recursive:true});
 const db=new DatabaseSync(dbPath);db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 db.exec(`CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), event_json TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS greetings (
 id TEXT PRIMARY KEY, idempotency_key TEXT UNIQUE, payload_hash TEXT, receipt_token TEXT NOT NULL,
 recipient_id TEXT NOT NULL, recipient_name TEXT NOT NULL, message TEXT NOT NULL, signature TEXT NOT NULL,
 class_name TEXT NOT NULL, visibility TEXT NOT NULL CHECK(visibility IN ('public','private')),
 gift TEXT NOT NULL CHECK(gift IN ('none','flowers','book','tea','coffee')),
 status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),created_at TEXT NOT NULL,
 moderated_at TEXT,is_sample INTEGER NOT NULL DEFAULT 0 CHECK(is_sample IN(0,1)));
 CREATE INDEX IF NOT EXISTS greetings_public ON greetings(visibility,status,created_at);`);
 // Additive migration preserves existing cards and idempotency fingerprints.
 if(!db.prepare('PRAGMA table_info(greetings)').all().some(c=>c.name==='bouquet_json'))db.exec('ALTER TABLE greetings ADD COLUMN bouquet_json TEXT');
 if(!db.prepare('PRAGMA table_info(greetings)').all().some(c=>c.name==='book_json'))db.exec('ALTER TABLE greetings ADD COLUMN book_json TEXT');
 migrateCoffeeGift(db);
 db.prepare('INSERT OR IGNORE INTO settings(id,event_json) VALUES(1,?)').run(JSON.stringify(DEFAULT_EVENT));
 const insert=db.prepare('INSERT INTO greetings(id,idempotency_key,payload_hash,receipt_token,recipient_id,recipient_name,message,signature,class_name,visibility,gift,status,created_at,moderated_at,is_sample,bouquet_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
 const seed=[['00000000-0000-4000-8000-000000000001','[THIỆP MẪU] Cảm ơn thầy cô đã khơi gợi niềm ham học hỏi.','flowers'],['00000000-0000-4000-8000-000000000002','[THIỆP MẪU] Chúc thầy cô luôn mạnh khỏe và có nhiều niềm vui trong công việc.','book'],['00000000-0000-4000-8000-000000000003','[THIỆP MẪU] Một lời tri ân gửi tới tập thể thầy cô VJU.','tea']];
 for(const [id,message,gift] of (seedSamples?seed:[]))if(!db.prepare('SELECT id FROM greetings WHERE id=?').get(id))insert.run(id,null,null,randomBytes(32).toString('base64url'),'general',GENERAL.name,message,'Thiệp mẫu','', 'public',gift,'approved',new Date().toISOString(),null,1,null);
 const recipientMap=new Map([[GENERAL.id,GENERAL.name]]);
 if(!Array.isArray(recipients))throw Error('recipients must be an array.');
 for(const r of recipients){if(r&&typeof r.id==='string'&&/^[a-zA-Z0-9_-]{1,50}$/.test(r.id)&&r.id!=='general'&&typeof r.name==='string'&&r.name.trim()&&[...r.name].length<=120)recipientMap.set(r.id,r.name.trim());else throw Error('Invalid recipient configuration.');}
 const rates=new Map();let requestCount=0;
 function rate(req,res,bucket,limit,windowMs){const now=Date.now(),who=bucket.startsWith('global-')?'all':bucket==='admin-failure'?req.socket.remoteAddress:['write','submit','garden-submit','presence'].includes(bucket)&&req.participantKey?'user:'+req.participantKey:clientAddress(req,trustedClientIpHeader),key=`${who}:${bucket}`;let entry=rates.get(key);if(!entry||entry.until<=now){entry={count:0,until:now+windowMs};rates.set(key,entry);}if(++requestCount%100===0)for(const[k,v]of rates)if(v.until<=now)rates.delete(k);if(++entry.count>limit){res.setHeader('Retry-After',String(Math.ceil((entry.until-now)/1000)));fail(429,'RATE_LIMIT','Bạn gửi quá nhanh. Vui lòng thử lại sau.');}}
 function event(){const e=JSON.parse(db.prepare('SELECT event_json FROM settings WHERE id=1').get().event_json);return {...e,autoApprove:e.autoApprove!==false,publicOnly,acceptingSubmissions:submissionsEnabled&&e.acceptingSubmissions&&(!e.closingAt||Date.now()<Date.parse(e.closingAt))};}
 function admin(req,res){if(req.moderationRole){const route=new URL(req.url,'http://local').pathname;if(req.moderationRole==='moderator'&&route!=='/api/admin/approval-mode'&&!/^\/api\/admin\/(?:greetings|feedback)(?:$|\/)/.test(route))fail(403,'FORBIDDEN','Administrator permission required.');return;}if(!constantEqual(bearer(req),adminToken)){rate(req,res,'admin-failure',10,600000);fail(401,'UNAUTHORIZED','Cần mã quản trị hợp lệ.');}}
 function origin(req,res){
  let host;try{const u=new URL(`http://${req.headers.host}`);if(u.host!==req.headers.host||u.username||u.password)throw Error();host=u.hostname;}catch{fail(403,'HOST_FORBIDDEN','Host không được phép.');}
  const local=['127.0.0.1','localhost','[::1]'].includes(host);
  const remote=publicOrigin&&req.headers.host===new URL(publicOrigin).host;
  if(!local&&!remote)fail(403,'HOST_FORBIDDEN','Host không được phép.');
  const supplied=req.headers.origin;if(!supplied)return;
  const allowed=remote?new Set([publicOrigin]):new Set([`http://${req.headers.host}`,'http://127.0.0.1:5173','http://localhost:5173',...(devOrigin?[devOrigin]:[])]);
  if(!allowed.has(supplied))fail(403,'ORIGIN_FORBIDDEN','Nguồn yêu cầu không được phép.');
  res.setHeader('Access-Control-Allow-Origin',supplied);res.setHeader('Vary','Origin');
 }
 const sso=createSso(db,{config:ssoConfig,json,fail,rate,loginRateLimit});
 const participants=createParticipants(db,{enabled:trialAccounts,sso,publicOrigin,devOrigin,json,readJson,textField,fail,rate,loginRateLimit});
 const identity=req=>Object.hasOwn(req,'participantIdentity')?req.participantIdentity:(gardenIdentity||participants.identity)(req);
 const admission=createCampusAdmission({capacity:campusCapacity,queueLimit:campusQueueLimit,idleMs:campusIdleMs,now:campusNow,onRelease:owner=>{teaRoute.release(owner);campfireRoute.release(owner);db.prepare('DELETE FROM library_sessions WHERE owner=?').run(owner);}});
 const admissionRoute=campusRoute(admission,{identity,fail,json,readJson});
 const gardenRoute=createGarden(db,{fail,textField,readJson,json,rate,event,identity:gardenIdentity||(trialAccounts?participants.identity:sso.identity),participants:trialAccounts?participants:null,ssoConfigured:!!sso.identity});
 const playRoute=createPlay(db,{identity,admission,fail,json,readJson,enabled:playEnabled,admin});
 const campfireRoute=createTeaRoom({identity,admission,fail,json,readJson,enabled:playEnabled,path:'/api/campfire'});
 const teaRoute=createTeaRoom({identity,admission,fail,json,readJson,enabled:playEnabled});
 const libraryRoute=createLibrary(db,{identity,admission,fail,json,readJson,enabled:playEnabled});
 const presenceRoute=createPresence({identity,admission,fail,json,readJson});
 const feedbackRoute=createFeedback(db,{identity,admin,json,readJson,textField,fail,rate});
 const reflectionRoute=createReflections(db,{fail,textField,readJson,json,admin});
 async function api(req,res,url){
  req.participantIdentity=await identity(req);req.participantKey=req.participantIdentity?participantOwner(req.participantIdentity):null;
  // Motion (up to 4Hz) has a separate per-account AND global budget.
  const presenceRequest=url.pathname==='/api/presence';
  if(presenceRequest){rate(req,res,'global-presence',60000,60000);rate(req,res,'presence',360,60000);}
  else if(req.method==='GET')rate(req,res,'read',readRateLimit,60000);
  else{rate(req,res,'global-write',globalWriteRateLimit,60000);rate(req,res,'write',req.participantKey?writeRateLimit:globalWriteRateLimit,60000);}
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, Idempotency-Key','Access-Control-Max-Age':'600'});return res.end();}
  const route=url.pathname;
  if(await admissionRoute(req,res,url))return;
  if(['/api/auth/logout','/api/auth/sso/logout'].includes(route)&&req.method==='POST'&&req.participantKey&&req.headers.origin)admission.leave(req.participantKey);
  if(route.startsWith('/api/admin/')){
   req.moderationRole=moderationRole(await sso.identity?.(req),moderationGrants());
   if(req.moderationRole&&req.method!=='GET'&&req.headers.origin!==ssoConfig.appOrigin)fail(403,'ORIGIN_FORBIDDEN','Invalid request origin.');
   if(req.method==='GET'&&route==='/api/admin/session')return json(res,200,{role:req.moderationRole,ssoConfigured:!!sso.identity});
  }
  if(await feedbackRoute(req,res,url))return;
  if(await teaRoute(req,res,url))return;
  if(await campfireRoute(req,res,url))return;
  if(await libraryRoute(req,res,url))return;
  if(await presenceRoute(req,res,url))return;
  if(await playRoute(req,res,url))return;
  if(await reflectionRoute(req,res,url))return;
  if(await sso.route(req,res,url))return;
  if(await participants.route(req,res,url))return;
  if(await gardenRoute(req,res,url))return;
  if(req.method==='GET'&&route==='/api/health')return json(res,200,{status:'ok',release:releaseSha,mode:'rehearsal',acceptingSubmissions:event().acceptingSubmissions});
  if(req.method==='GET'&&route==='/api/config')return json(res,200,{event:event(),recipients:[...recipientMap].map(([id,name])=>({id,name}))});
  if(req.method==='GET'&&route==='/api/greetings/board'){
   const raw=url.searchParams.get('page')||'0';if(!/^(0|[1-9][0-9]{0,6})$/.test(raw))fail(400,'INVALID_PAGE','Lượt lời chúc không hợp lệ.');
   const total=db.prepare(`SELECT count(*) AS n FROM greetings WHERE status='approved' AND visibility='public' AND (is_sample=0 OR ${seedSamples?1:0})`).get().n;
   const pageSize=24,pages=Math.max(1,Math.ceil(total/pageSize)),page=Math.min(Number(raw),pages-1);
   const rows=db.prepare(`SELECT * FROM greetings WHERE status='approved' AND visibility='public' AND (is_sample=0 OR ${seedSamples?1:0}) ORDER BY created_at ASC,id ASC LIMIT ? OFFSET ?`).all(pageSize,page*pageSize);
   return json(res,200,{greetings:rows.map(publicCard),page,pageSize,total,pages});
  }
  if(req.method==='GET'&&route==='/api/greetings')return json(res,200,{greetings:db.prepare(`SELECT * FROM greetings WHERE status='approved' AND visibility='public' AND (is_sample=0 OR ${seedSamples?1:0}) ORDER BY created_at DESC,id DESC LIMIT 100`).all().map(publicCard)});
  if(req.method==='POST'&&route==='/api/greetings'){
   const participant=trialAccounts?await participants.requireUser(req):null;
   const owner=participant?participantOwner(participant):null;
   rate(req,res,'submit',submissionRateLimit,600000);
   const key=req.headers['idempotency-key'];if(typeof key!=='string'||!UUID.test(key))fail(400,'IDEMPOTENCY_REQUIRED','Cần mã gửi duy nhất dạng UUID.');
   const input=await readJson(req);if(Object.keys(input).some(k=>!['recipientId','recipientName','bookTitle','bookAuthor','message','signature','className','visibility','gift','bouquet'].includes(k)))fail(400,'INVALID_INPUT','Có trường dữ liệu không được hỗ trợ.');
   const recipientId=textField(input.recipientId,'Người nhận',50,true),customRecipient=['teacher','other'].includes(recipientId);
   if(!recipientMap.has(recipientId)&&!customRecipient)fail(400,'UNKNOWN_RECIPIENT','Người nhận chưa được cấu hình.');
   if(!['public','private'].includes(input.visibility))fail(400,'INVALID_VISIBILITY','Chọn lời chúc công khai hoặc riêng tư.');
   if(!['none','flowers','book','tea','coffee'].includes(input.gift))fail(400,'INVALID_GIFT','Quà biểu tượng không hợp lệ.');
   const payload={recipientId,message:textField(input.message,'Lời chúc',LIMITS.message,true),signature:textField(input.signature,'Chữ ký',LIMITS.signature),className:textField(input.className,'Lớp',LIMITS.className),visibility:input.visibility,gift:input.gift};
   if(customRecipient)payload.recipientName=textField(input.recipientName,'Tên người nhận',120,true);
   else if(textField(input.recipientName,'Tên người nhận',120))fail(400,'INVALID_INPUT','Chỉ nhập tên khi chọn Thầy/Cô cụ thể hoặc Khác.');
   const bookTitle=textField(input.bookTitle,'Tên sách',160),bookAuthor=textField(input.bookAuthor,'Tác giả',120);
   if(bookTitle||bookAuthor){
    if(input.gift!=='book'||!bookTitle||!bookAuthor)fail(400,'INVALID_INPUT','Quà sách cần cả tên sách và tác giả.');
    payload.bookTitle=bookTitle;payload.bookAuthor=bookAuthor;
   }
   if(input.bouquet!==undefined){
    if(input.gift!=='flowers'||!Array.isArray(input.bouquet)||input.bouquet.length!==5||!input.bouquet.every(k=>['rose','daisy','sunflower','cosmos','lavender','tulip','lotus','chrysanthemum','bidens'].includes(k)))fail(400,'INVALID_BOUQUET','Bó hoa cần đúng 5 bông thuộc các loại hoa trong vườn.');
    payload.bouquet=[...input.bouquet];
   }
   if([...payload.message].length<minMessageLength(payload.message))fail(400,'INVALID_INPUT','Lời chúc cần 10–1000 ký tự.');
   if(participant?.mode==='anonymous'){payload.signature='Khách ẩn danh';payload.className='';}
   const fingerprint=hash(JSON.stringify(payload)),prior=db.prepare('SELECT * FROM greetings WHERE idempotency_key=?').get(key.toLowerCase());
   if(prior){if(prior.payload_hash!==fingerprint||(owner&&db.prepare('SELECT owner FROM participant_submissions WHERE greeting_id=?').get(prior.id)?.owner!==owner))fail(409,'IDEMPOTENCY_CONFLICT','Mã gửi này đã dùng cho nội dung khác.');return json(res,200,{id:prior.id,receiptToken:prior.receipt_token,status:prior.status,duplicate:true});}
   if(publicOnly&&payload.visibility!=='public')fail(400,'PUBLIC_ONLY','Thiệp mới chỉ hỗ trợ gửi lên bảng công khai. Hãy xem lại lựa chọn hiển thị.');
   if(!event().acceptingSubmissions)fail(403,'EVENT_CLOSED','Hiện không nhận thêm lời chúc.');
   // Keep the original request fingerprint for retries, including legacy receipts.
   // Normalize only newly stored display text; never rewrite historical rows.
   for(const field of ['message','signature','className'])payload[field]=payload[field].replace(/[\u202A-\u202E\u2066-\u2069\u200B\uFEFF]/gu,'').replace(/\r\n?/g,'\n').replace(/[^\S\n]+/gu,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
   if([...payload.message].length<minMessageLength(payload.message))fail(400,'INVALID_INPUT','Lời chúc cần ít nhất 10 ký tự có nội dung.');
   const id=randomUUID(),token=randomBytes(32).toString('base64url'),status=event().autoApprove?'approved':'pending',createdAt=new Date().toISOString();
   db.exec('BEGIN IMMEDIATE');try{
    if(owner)participants.checkLimit(owner);
    insert.run(id,key.toLowerCase(),fingerprint,token,recipientId,payload.recipientName||recipientMap.get(recipientId),payload.message,payload.signature,payload.className,payload.visibility,payload.gift,status,createdAt,status==='approved'?createdAt:null,0,payload.bouquet?JSON.stringify(payload.bouquet):null);
    if(payload.bookTitle)db.prepare('UPDATE greetings SET book_json=? WHERE id=?').run(JSON.stringify({bookTitle:payload.bookTitle,bookAuthor:payload.bookAuthor}),id);
    if(owner)participants.record(owner,id);db.exec('COMMIT');
   }catch(e){db.exec('ROLLBACK');throw e;}
   return json(res,201,{id,receiptToken:token,status,duplicate:false});
  }
  const receipt=/^\/api\/receipts\/([a-fA-F0-9-]+)$/.exec(route);
  if(req.method==='GET'&&receipt){const row=UUID.test(receipt[1])?db.prepare('SELECT * FROM greetings WHERE id=?').get(receipt[1]):null;if(!row||row.is_sample||!constantEqual(bearer(req),row.receipt_token))fail(404,'NOT_FOUND','Không tìm thấy phiếu xác nhận hợp lệ.');return json(res,200,{status:row.status,visibility:row.visibility,recipientName:row.recipient_name,...(row.bouquet_json?{bouquet:JSON.parse(row.bouquet_json)}:{})});}
  if(route.startsWith('/api/admin/')){
   admin(req,res);
   if(req.method==='GET'&&route==='/api/admin/greetings'){const status=url.searchParams.get('status')||'pending';if(!['pending','approved','rejected','all'].includes(status))fail(400,'INVALID_STATUS','Bộ lọc trạng thái không hợp lệ.');const query='SELECT g.*,p.sequence AS garden_sequence FROM greetings g LEFT JOIN garden_pots p ON p.greeting_id=g.id';const rows=status==='all'?db.prepare(query+' ORDER BY g.created_at DESC').all():db.prepare(query+' WHERE g.status=? ORDER BY g.created_at DESC').all(status);return json(res,200,{greetings:rows.map(adminCard)});}
   const gardenEdit=/^\/api\/admin\/greetings\/([a-fA-F0-9-]+)\/garden-edit$/.exec(route);
   if(req.method==='POST'&&gardenEdit){
    const input=await readJson(req);
    if(Object.keys(input).some(k=>!['signature','recipientName','message','expected'].includes(k)))fail(400,'INVALID_INPUT','Dữ liệu không hợp lệ.');
    const row=db.prepare('SELECT g.* FROM greetings g JOIN garden_pots p ON p.greeting_id=g.id WHERE g.id=?').get(gardenEdit[1]);
    if(!row)fail(404,'NOT_FOUND','Không tìm thấy lời chúc.');
    if(!input.expected||['signature','recipientName','message'].some(k=>input.expected[k]!==({signature:row.signature,recipientName:row.recipient_name,message:row.message})[k]))fail(409,'EDIT_CONFLICT','Nội dung đã thay đổi. Tải lại trước khi sửa.');
    const signature=textField(input.signature,'Tên ghi trên chậu',60,true),recipient=textField(input.recipientName,'Người nhận',60,true),message=textField(input.message,'Lời cảm ơn',240,true);
    if([...message].length<minMessageLength(message))fail(400,'INVALID_INPUT','Lời cảm ơn quá ngắn.');
    db.prepare('UPDATE greetings SET signature=?,recipient_name=?,message=? WHERE id=?').run(signature,recipient,message,row.id);
    return json(res,200,{ok:true,id:row.id});
   }
   const moderation=/^\/api\/admin\/greetings\/([a-fA-F0-9-]+)\/moderate$/.exec(route);
   if(req.method==='POST'&&moderation){const input=await readJson(req);if(Object.keys(input).some(k=>k!=='action')||!['approve','reject'].includes(input.action))fail(400,'INVALID_ACTION','Chọn duyệt hoặc từ chối.');const row=db.prepare('SELECT * FROM greetings WHERE id=?').get(moderation[1]);if(!row)fail(404,'NOT_FOUND','Không tìm thấy lời chúc.');const status=input.action==='approve'?'approved':'rejected';db.prepare('UPDATE greetings SET status=?,moderated_at=? WHERE id=?').run(status,new Date().toISOString(),row.id);return json(res,200,{id:row.id,status});}
   if(req.method==='POST'&&route==='/api/admin/approval-mode'){
    const input=await readJson(req);
    if(Object.keys(input).length!==1||typeof input.autoApprove!=='boolean')fail(400,'INVALID_SETTINGS','autoApprove must be a boolean.');
    const stored=JSON.parse(db.prepare('SELECT event_json FROM settings WHERE id=1').get().event_json);
    db.prepare('UPDATE settings SET event_json=? WHERE id=1').run(JSON.stringify({...stored,autoApprove:input.autoApprove}));
    return json(res,200,{event:event()});
   }
   if(req.method==='POST'&&route==='/api/admin/settings'){
    const input=await readJson(req),allowed=['autoApprove','acceptingSubmissions','effectsEnabled','closingAt','mode'];if(!Object.keys(input).length||Object.keys(input).some(k=>!allowed.includes(k)))fail(400,'INVALID_SETTINGS','Cấu hình không hợp lệ.');
    for(const key of ['autoApprove','acceptingSubmissions','effectsEnabled'])if(key in input&&typeof input[key]!=='boolean')fail(400,'INVALID_SETTINGS',`${key} cần true hoặc false.`);
    if('mode'in input&&input.mode!=='rehearsal')fail(400,'INVALID_SETTINGS','Bản local chỉ hỗ trợ chế độ diễn tập.');
    if('closingAt'in input&&input.closingAt!==null&&(typeof input.closingAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(input.closingAt)||!Number.isFinite(Date.parse(input.closingAt))))fail(400,'INVALID_SETTINGS','closingAt cần ISO 8601 có múi giờ hoặc null.');
    const stored=JSON.parse(db.prepare('SELECT event_json FROM settings WHERE id=1').get().event_json);db.prepare('UPDATE settings SET event_json=? WHERE id=1').run(JSON.stringify({...stored,...input}));return json(res,200,{event:event()});
   }
  }
  fail(404,'NOT_FOUND','Không tìm thấy API.');
 }
 const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
 function staticFile(req,res,url){
  if(!['GET','HEAD'].includes(req.method))fail(405,'METHOD_NOT_ALLOWED','Phương thức không được hỗ trợ.');
  let pathname;try{pathname=decodeURIComponent((req.url||'/').split('?')[0]);}catch{fail(400,'BAD_PATH','Đường dẫn không hợp lệ.');}
  if(pathname.includes('\\')||pathname.includes('\0')||pathname.split('/').some(p=>p==='..'||p.startsWith('.')))fail(404,'NOT_FOUND','Không tìm thấy tệp.');
  if(!existsSync(staticRoot))fail(503,'BUILD_REQUIRED','Chạy npm run build trước khi mở bản production local.');
  const base=realpathSync(staticRoot);let candidate=path.resolve(base,'.'+pathname);
  if(pathname==='/')candidate=path.join(base,'index.html');
  if(!existsSync(candidate)&&!path.extname(pathname))candidate=path.join(base,'index.html');
  if(!existsSync(candidate)||!statSync(candidate).isFile())fail(404,'NOT_FOUND','Không tìm thấy tệp.');
  const real=realpathSync(candidate);if(!real.startsWith(base+path.sep)||!mime[path.extname(real)])fail(404,'NOT_FOUND','Không tìm thấy tệp.');
  res.writeHead(200,{'Content-Type':mime[path.extname(real)],'Cache-Control':path.extname(real)==='.html'?'no-cache':'public,max-age=3600','Content-Length':statSync(real).size});res.end(req.method==='HEAD'?undefined:readFileSync(real));
 }
 const diagnostics=createDiagnostics(logger);
 const server=http.createServer(async(req,res)=>{
  const requestId=diagnostics.begin(req,res);
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  try{origin(req,res);const url=new URL(req.url||'/','http://localhost');if(url.pathname.startsWith('/api/'))await api(req,res,url);else staticFile(req,res,url);}catch(error){if(!(error instanceof ApiError))diagnostics.error(req,error,requestId);if(!res.headersSent){if(error.status===413)res.setHeader('Connection','close');json(res,error instanceof ApiError?error.status:500,{error:error instanceof ApiError?error.message:'Lỗi máy chủ. Vui lòng thử lại.',code:error instanceof ApiError?error.code:'INTERNAL_ERROR'});}else res.end();}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.on('close',()=>{diagnostics.close();db.close();});
 return server;
}
