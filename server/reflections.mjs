import {randomUUID} from 'node:crypto';

export function vietnamDate(now=new Date()) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const get=type=>parts.find(p=>p.type===type).value;return `${get('year')}-${get('month')}-${get('day')}`;
}
const statuses=['draft','pending','approved','published','archived'];
const fields={topic:120,content:4000,author:160,sourceBook:300,sourceReference:1000,sourceUrl:1000,sourcePages:80,attributionNote:500,question:1500};
const DEMO_ID='10000000-0000-4000-8000-000000000001';
const publicItem=r=>({id:r.id,topic:r.topic,content:r.content,author:r.author,sourceBook:r.source_book,sourceReference:r.source_reference,sourceUrl:r.source_url,sourcePages:r.source_pages,attributionNote:r.attribution_note,quoteType:r.quote_type,question:r.question,displayDate:r.display_date});
const adminItem=r=>({...publicItem(r),status:r.status,sourceVerified:!!r.source_verified,contentOrigin:r.content_origin,revision:r.revision,createdAt:r.created_at,updatedAt:r.updated_at,approvedAt:r.approved_at,publishedAt:r.published_at});

/** Additive, isolated from greeting moderation. Every publication is an explicit admin action. */
export function createReflections(db,{fail,textField,readJson,json,admin,now=()=>new Date()}) {
 db.exec(`CREATE TABLE IF NOT EXISTS reflections (
 id TEXT PRIMARY KEY,topic TEXT NOT NULL,content TEXT NOT NULL,author TEXT NOT NULL,
 source_book TEXT NOT NULL DEFAULT '',source_reference TEXT NOT NULL DEFAULT '',source_url TEXT NOT NULL DEFAULT '',source_pages TEXT NOT NULL DEFAULT '',attribution_note TEXT NOT NULL DEFAULT '',
 quote_type TEXT NOT NULL CHECK(quote_type IN ('verbatim','paraphrase')),question TEXT NOT NULL,
 source_verified INTEGER NOT NULL DEFAULT 0 CHECK(source_verified IN(0,1)),content_origin TEXT NOT NULL CHECK(content_origin IN ('editorial','ai_assisted','demo')),
 status TEXT NOT NULL CHECK(status IN ('draft','pending','approved','published','archived')),display_date TEXT,
 revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,approved_at TEXT,published_at TEXT);
 CREATE UNIQUE INDEX IF NOT EXISTS reflections_one_per_day ON reflections(display_date) WHERE status='published';
 CREATE INDEX IF NOT EXISTS reflections_library ON reflections(status,display_date);
 CREATE TABLE IF NOT EXISTS reflection_history (
 id INTEGER PRIMARY KEY,reflection_id TEXT NOT NULL REFERENCES reflections(id),action TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL);
 `);
 const stamp=()=>now().toISOString();
 db.prepare(`INSERT OR IGNORE INTO reflections(id,topic,content,author,quote_type,question,attribution_note,content_origin,status,created_at,updated_at)
 VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(DEMO_ID,"Thử lại có mục đích","Sau một lần thử chưa thành công, hãy giữ lại điều đã quan sát được. Chọn một giả thuyết nhỏ, đổi một yếu tố và thử lại. Một kết quả khác dự đoán vẫn có ích nếu ta biết mình đã làm gì.","VJU2011","paraphrase","Ở lần thử tiếp theo, bạn sẽ thay đổi yếu tố nào và giữ nguyên những gì?","Original project text; MIT.","demo","draft",stamp(),stamp());
 const get=id=>{const row=db.prepare('SELECT * FROM reflections WHERE id=?').get(id);if(!row)fail(404,'NOT_FOUND','Không tìm thấy suy ngẫm.');return row;};
 function validate(input){
  const allowed=[...Object.keys(fields),'quoteType','sourceVerified','contentOrigin','displayDate','revision'];
  if(Object.keys(input).some(k=>!allowed.includes(k)))fail(400,'INVALID_INPUT','Có trường nội dung không được hỗ trợ.');
  const value={};for(const [key,max] of Object.entries(fields))value[key]=textField(input[key],key,max,['topic','content','author','question'].includes(key));
  if(!['paraphrase','verbatim'].includes(input.quoteType))fail(400,'INVALID_QUOTE_TYPE','Chọn Nguyên văn hoặc Diễn giải.');
  if(typeof input.sourceVerified!=='boolean'||!['editorial','ai_assisted','demo'].includes(input.contentOrigin))fail(400,'INVALID_INPUT','Thông tin kiểm chứng hoặc nguồn soạn chưa hợp lệ.');
  if(value.sourceUrl){let u;try{u=new URL(value.sourceUrl);}catch{}if(!u||!['https:','http:'].includes(u.protocol)||u.username||u.password)fail(400,'INVALID_SOURCE_URL','Đường dẫn nguồn cần là URL http hoặc https hợp lệ.');}
  const date=input.displayDate;
  if(date!==null&&(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))fail(400,'INVALID_DATE','Ngày hiển thị cần là ngày hợp lệ, hoặc để trống.');
  return {...value,quoteType:input.quoteType,sourceVerified:input.sourceVerified,contentOrigin:input.contentOrigin,displayDate:date};
 }
 const values=v=>[v.topic,v.content,v.author,v.sourceBook,v.sourceReference,v.sourceUrl,v.sourcePages,v.attributionNote,v.quoteType,v.question,Number(v.sourceVerified),v.contentOrigin,v.displayDate];
 function checkedRevision(input,row){if(!Number.isSafeInteger(input.revision)||input.revision!==row.revision)fail(409,'REVISION_CONFLICT','Bài đã được thay đổi ở nơi khác. Tải lại trước khi lưu hoặc duyệt.');}
 function ready(row){
  if(!row.source_verified||(!row.source_book&&!row.source_reference))fail(400,'SOURCE_REQUIRED','Cần ghi nguồn tham chiếu và xác nhận đã đối chiếu trước khi duyệt.');
  if(row.quote_type==='verbatim'&&(!row.source_book||!row.source_pages))fail(400,'VERBATIM_SOURCE_REQUIRED','Trích dẫn nguyên văn cần tên sách/tài liệu và số trang hoặc vị trí trích dẫn.');
 }
 function transaction(work){db.exec('BEGIN IMMEDIATE');try{const result=work();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
 const history=(id,action,revision)=>db.prepare('INSERT INTO reflection_history(reflection_id,action,revision,created_at) VALUES(?,?,?,?)').run(id,action,revision,stamp());
 return async function route(req,res,url){
  const route=url.pathname,isAdmin=route.startsWith('/api/admin/reflections');
  if(!isAdmin&&!route.startsWith('/api/reflections'))return false;
  const today=vietnamDate(now());
  if(isAdmin)admin(req,res);
  if(req.method==='GET'&&route==='/api/reflections/today'){
   const row=db.prepare("SELECT * FROM reflections WHERE status='published' AND display_date=?").get(today);
   json(res,200,{date:today,timeZone:'Asia/Ho_Chi_Minh',reflection:row?publicItem(row):null});return true;
  }
  if(req.method==='GET'&&route==='/api/reflections/library'){
   const raw=url.searchParams.get('page')||'0';if(!/^(0|[1-9][0-9]{0,5})$/.test(raw))fail(400,'INVALID_PAGE','Trang thư viện không hợp lệ.');
   const total=db.prepare("SELECT count(*) AS n FROM reflections WHERE status='published' AND display_date<?").get(today).n;
   const pageSize=12,pages=Math.max(1,Math.ceil(total/pageSize)),page=Math.min(Number(raw),pages-1);
   const rows=db.prepare("SELECT * FROM reflections WHERE status='published' AND display_date<? ORDER BY display_date DESC LIMIT ? OFFSET ?").all(today,pageSize,page*pageSize);
   json(res,200,{date:today,items:rows.map(publicItem),page,pageSize,pages,total});return true;
  }
  const publicMatch=/^\/api\/reflections\/([a-f0-9-]{36})$/.exec(route);
  if(req.method==='GET'&&publicMatch){const row=db.prepare("SELECT * FROM reflections WHERE id=? AND status='published' AND display_date<=?").get(publicMatch[1],today);if(!row)fail(404,'NOT_FOUND','Nội dung chưa được công bố hoặc không tồn tại.');json(res,200,{reflection:publicItem(row)});return true;}
  if(req.method==='GET'&&route==='/api/admin/reflections'){
   const status=url.searchParams.get('status')||'all';if(!['all',...statuses].includes(status))fail(400,'INVALID_STATUS','Trạng thái không hợp lệ.');
   const raw=url.searchParams.get('page')||'0';if(!/^(0|[1-9][0-9]{0,5})$/.test(raw))fail(400,'INVALID_PAGE','Trang không hợp lệ.');
   const where=status==='all'?'1=1':'status=?',args=status==='all'?[]:[status];
   const total=db.prepare(`SELECT count(*) AS n FROM reflections WHERE ${where}`).get(...args).n,pageSize=30,pages=Math.max(1,Math.ceil(total/pageSize)),page=Math.min(Number(raw),pages-1);
   const items=db.prepare(`SELECT * FROM reflections WHERE ${where} ORDER BY updated_at DESC,id LIMIT ? OFFSET ?`).all(...args,pageSize,page*pageSize).map(adminItem);
   json(res,200,{items,page,pages,total,today});return true;
  }
  if(req.method==='POST'&&route==='/api/admin/reflections'){
   const v=validate(await readJson(req)),id=randomUUID();
   transaction(()=>{db.prepare(`INSERT INTO reflections(id,topic,content,author,source_book,source_reference,source_url,source_pages,attribution_note,quote_type,question,source_verified,content_origin,display_date,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',?,?)`).run(id,...values(v),stamp(),stamp());history(id,'create',1);});
   json(res,201,{reflection:adminItem(get(id))});return true;
  }
  const match=/^\/api\/admin\/reflections\/([a-f0-9-]{36})(?:\/(action))?$/.exec(route);
  if(match&&req.method==='GET'&&!match[2]){json(res,200,{reflection:adminItem(get(match[1]))});return true;}
  if(match&&req.method==='POST'){
   const input=await readJson(req),id=match[1];
   const result=transaction(()=>{
    const row=get(id);checkedRevision(input,row);
    if(!match[2]){
     const v=validate(input);db.prepare(`UPDATE reflections SET topic=?,content=?,author=?,source_book=?,source_reference=?,source_url=?,source_pages=?,attribution_note=?,quote_type=?,question=?,source_verified=?,content_origin=?,display_date=?,status='draft',approved_at=NULL,published_at=NULL,revision=revision+1,updated_at=? WHERE id=?`).run(...values(v),stamp(),id);history(id,'edit',row.revision+1);
    }else{
     if(Object.keys(input).some(k=>!['revision','action'].includes(k)))fail(400,'INVALID_INPUT','Thao tác không hợp lệ.');
     const transitions={submit:{from:['draft'],to:'pending'},approve:{from:['pending'],to:'approved'},publish:{from:['approved'],to:'published'},return:{from:['pending','approved','published','archived'],to:'draft'},archive:{from:['published'],to:'archived'}};
     const transition=typeof input.action==='string'&&Object.hasOwn(transitions,input.action)?transitions[input.action]:null;if(!transition||!transition.from.includes(row.status))fail(409,'INVALID_TRANSITION','Thao tác không phù hợp với trạng thái bài.');
     if(['approve','publish'].includes(input.action))ready(row);
     if(input.action==='publish'){
      if(!row.display_date)fail(400,'DATE_REQUIRED','Cần chọn ngày hiển thị trước khi xuất bản.');
      if(db.prepare("SELECT id FROM reflections WHERE status='published' AND display_date=? AND id<>?").get(row.display_date,id))fail(409,'DATE_OCCUPIED','Ngày này đã có một suy ngẫm. Chọn ngày khác hoặc gỡ bài đang được xếp lịch.');
     }
     const clear=input.action==='return';db.prepare('UPDATE reflections SET status=?,revision=revision+1,updated_at=?,approved_at=?,published_at=? WHERE id=?').run(transition.to,stamp(),clear?null:input.action==='approve'?stamp():row.approved_at,clear?null:input.action==='publish'?stamp():row.published_at,id);history(id,input.action,row.revision+1);
    }
    return adminItem(get(id));
   });json(res,200,{reflection:result});return true;
  }
  fail(404,'NOT_FOUND','Không tìm thấy API suy ngẫm.');
 };
}
