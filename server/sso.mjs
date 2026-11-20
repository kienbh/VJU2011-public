import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
const hash=v=>createHash('sha256').update(v).digest('hex');
const random=()=>randomBytes(32).toString('base64url');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const cookie=(req,key)=>(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(key+'='))?.slice(key.length+1)||'';

/** BCSE ID's existing HS256 authorization-code integration, with an app-local session. */
export function verifyBcseToken(token,config,now=Date.now()){
 if(typeof token!=='string'||token.length>16000)throw Error('Invalid identity token');
 const parts=token.split('.');if(parts.length!==3)throw Error('Invalid identity token');
 const header=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
 if(header.alg!=='HS256'||header.crit)throw Error('Invalid identity algorithm');
 const signature=createHmac('sha256',config.jwtSecret).update(parts[0]+'.'+parts[1]).digest('base64url');
 if(!equal(signature,parts[2]))throw Error('Invalid identity signature');
 const p=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8')),seconds=now/1000;
 if(p.iss!==config.issuer||p.aud!==config.clientId||typeof p.sub!=='string'||!p.sub||p.sub.length>256||!Number.isFinite(p.exp)||p.exp<=seconds||!Number.isFinite(p.iat)||p.iat>seconds+30||(p.nbf!==undefined&&(!Number.isFinite(p.nbf)||p.nbf>seconds)))throw Error('Invalid identity claims');
 return p;
}

export function createSso(db,{config,json,fail,rate,loginRateLimit=600}){
 if(!config)return {identity:null,route:async()=>false};
 const {issuer,clientId,clientSecret,jwtSecret,appOrigin}=config;
 if(new URL(issuer).origin!==issuer||!issuer.startsWith('https://')||!clientId||!clientSecret||jwtSecret?.length<32||new URL(appOrigin).origin!==appOrigin||(!appOrigin.startsWith('https://')&&!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(appOrigin)))throw Error('Invalid BCSE ID configuration');
 const secure=appOrigin.startsWith('https://'),prefix=secure?'__Host-':'',sessionName=prefix+'vju_session',stateName=prefix+'vju_sso';
 const setCookie=(res,name,value,age)=>res.setHeader('Set-Cookie',`${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure?'; Secure':''}`);
 const redirect=(res,where)=>{res.writeHead(303,{Location:where,'Cache-Control':'no-store'});res.end();};
 db.exec(`CREATE TABLE IF NOT EXISTS garden_sessions(token_hash TEXT PRIMARY KEY,issuer TEXT NOT NULL,subject TEXT NOT NULL,name TEXT NOT NULL,expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS garden_sso_states(state_hash TEXT PRIMARY KEY,browser_hash TEXT NOT NULL,expires_at INTEGER NOT NULL);`);
 const findSession=db.prepare('SELECT issuer,subject,name FROM garden_sessions WHERE token_hash=? AND expires_at>?');
 const identity=async req=>{
  const raw=cookie(req,sessionName);if(!raw||raw.length>128)return null;
  const row=findSession.get(hash(raw),Date.now());
  return row?{issuer:row.issuer,subject:row.subject,name:row.name}:null;
 };
 const callback=appOrigin+'/api/auth/sso/callback';
 async function route(req,res,url){
  if(!url.pathname.startsWith('/api/auth/sso/'))return false;
  // Authorize + callback for each student; shared school IP must not cap a class at 15.
  rate(req,res,'sso',loginRateLimit*2,600000);
  if(req.method==='GET'&&url.pathname==='/api/auth/sso/authorize'){
   db.prepare('DELETE FROM garden_sso_states WHERE expires_at<?').run(Date.now());db.prepare('DELETE FROM garden_sessions WHERE expires_at<?').run(Date.now());
   const state=random(),browser=random();db.prepare('INSERT INTO garden_sso_states VALUES(?,?,?)').run(hash(state),hash(browser),Date.now()+600000);
   setCookie(res,stateName,browser,600);
   const u=new URL('/authorize',issuer);for(const[k,v]of Object.entries({client_id:clientId,redirect_uri:callback,response_type:'code',scope:'openid profile email',state}))u.searchParams.set(k,v);
   redirect(res,u.toString());return true;
  }
  if(req.method==='GET'&&url.pathname==='/api/auth/sso/callback'){
   const state=url.searchParams.get('state')||'',code=url.searchParams.get('code')||'',browser=cookie(req,stateName);
   setCookie(res,stateName,'',0);
   const row=state.length<=128&&browser.length<=128?db.prepare('DELETE FROM garden_sso_states WHERE state_hash=? AND browser_hash=? AND expires_at>? RETURNING state_hash').get(hash(state),hash(browser),Date.now()):null;
   if(!row||!code||code.length>2048){redirect(res,'/?sso=failed');return true;}
   try{
    const response=await fetch(new URL('/api/oidc/token',issuer),{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/x-www-form-urlencoded',Authorization:'Basic '+Buffer.from(encodeURIComponent(clientId)+':'+encodeURIComponent(clientSecret)).toString('base64')},body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:callback})});
    if(!response.ok)throw Error('Exchange failed');
    const body=await response.json(),p=verifyBcseToken(body.id_token,config);
    const old=cookie(req,sessionName);if(old)db.prepare('DELETE FROM garden_sessions WHERE token_hash=?').run(hash(old));
    const token=random(),expiry=Math.min(p.exp*1000,Date.now()+8*3600000);
    db.prepare('INSERT INTO garden_sessions VALUES(?,?,?,?,?)').run(hash(token),issuer,p.sub,typeof p.name==='string'?p.name.slice(0,80):'Thành viên VJU',expiry);
    res.setHeader('Set-Cookie',[`${stateName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure?'; Secure':''}`,`${sessionName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor((expiry-Date.now())/1000)}${secure?'; Secure':''}`,`${prefix}vju_guest_active=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure?'; Secure':''}`]);
    redirect(res,'/?view=walk&festival=1&intro=0&garden=1');
   }catch{redirect(res,'/?sso=failed');}
   return true;
  }
  if(req.method==='POST'&&url.pathname==='/api/auth/sso/logout'){
   if(req.headers.origin!==appOrigin)fail(403,'ORIGIN_FORBIDDEN','Nguồn yêu cầu không hợp lệ.');
   db.prepare('DELETE FROM garden_sessions WHERE token_hash=?').run(hash(cookie(req,sessionName)));setCookie(res,sessionName,'',0);json(res,200,{ok:true});return true;
  }
  fail(404,'NOT_FOUND','Không tìm thấy trang đăng nhập.');
 }
 return {identity,route,clear:req=>db.prepare('DELETE FROM garden_sessions WHERE token_hash=?').run(hash(cookie(req,sessionName)))};
}
