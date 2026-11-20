import {randomUUID} from 'node:crypto';
import {participantOwner} from './participants.mjs';

// One small, transient room. Nothing here is written to the gratitude database.
export function createTeaRoom({identity,json,readJson,fail,enabled=true,now=Date.now,path='/api/tea',admission}){
 const members=new Map();
 const prune=()=>{for(const [owner,p] of members)if(p.until<=now()||(admission&&!admission.has(owner)))members.delete(owner);};
 const snapshot=owner=>({self:members.get(owner)?.id||null,members:[...members.values()].map(p=>({id:p.id,name:p.name,seat:p.seat,message:p.messageUntil>now()?p.message:'',messageId:p.messageUntil>now()?p.messageId:null}))});
 return Object.assign(async(req,res,url)=>{
  if(url.pathname!==path)return false;
  if(!enabled)fail(503,'TEA_DISABLED','Góc trà đá đang tạm nghỉ.');
  const user=await identity(req);if(!user)fail(401,'SIGN_IN_REQUIRED','Chọn Khách hoặc SSO để trò chuyện.');
  const owner=participantOwner(user);prune();
  if(req.method==='GET'){json(res,200,snapshot(owner));return true;}
  if(req.method!=='POST')fail(405,'METHOD','Phương thức không hợp lệ.');
  if(!req.headers.origin)fail(403,'ORIGIN_REQUIRED','Thiếu nguồn yêu cầu.');
  const b=await readJson(req);let p=members.get(owner);
  if(b.action!=='leave'&&admission&&!admission.has(owner))fail(409,'CAMPUS_REQUIRED','Cần vào campus trước.');
  if(b.action==='leave'){
   if(p&&b.lease===p.id)members.delete(owner);
  }else if(b.action==='join'){
   if(!Number.isInteger(b.seat)||b.seat<0||b.seat>=6)fail(400,'SEAT','Ghế không hợp lệ.');
   if([...members.entries()].some(([id,m])=>id!==owner&&m.seat===b.seat))fail(409,'OCCUPIED','Ghế đã có người ngồi. Mời bạn chọn ghế khác.');
   if(p&&p.seat!==b.seat)fail(409,'ALREADY_SEATED','Bạn đang ngồi ở một ghế khác.');
   if(!p){
    const name=user.mode==='anonymous'?'Khách ẩn danh':String(user.name||'Sinh viên VJU').normalize('NFC').replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,' ').slice(0,40);
    p={id:randomUUID(),name,seat:b.seat,until:0,message:'',messageId:null,messageUntil:0,lastSent:-Infinity};members.set(owner,p);
   }
   p.until=now()+18000;
  }else if(b.action==='pulse'||b.action==='say'){
   if(!p||b.lease!==p.id)fail(409,'LEFT_ROOM','Phiên ngồi đã hết. Bạn có thể chọn ghế lại.');
   if(b.action==='say'){
    if(typeof b.text!=='string'||typeof b.id!=='string'||!/^[-\da-f]{36}$/i.test(b.id))fail(400,'MESSAGE','Lời chat không hợp lệ.');
    const text=b.text.normalize('NFC').trim();
    if(!text||[...text].length>160||/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(text))fail(400,'MESSAGE','Viết từ 1 đến 160 ký tự trong một dòng.');
    if(b.id!==p.messageId){
     if(now()-p.lastSent<3000)fail(429,'SLOW_DOWN','Chờ một chút trước khi gửi tiếp nhé.');
     p.message=text;p.messageId=b.id;p.messageUntil=now()+12000;p.lastSent=now();
    }else if(text!==p.message)fail(409,'REPLAY_CONFLICT','Mã lời chat đã được dùng.');
   }
   p.until=now()+18000;
  }else fail(400,'ACTION','Thao tác không hợp lệ.');
  json(res,200,snapshot(owner));return true;
 },{release:owner=>members.delete(owner)});
}
