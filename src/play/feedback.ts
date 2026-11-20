import {requestTimeout} from '../browserCompat';
import {tr,trServer} from '../i18n/index.ts';
import {currentParticipant} from '../greetings/participation';
import './feedback.css';
type Payload={category:string;subject:string;message:string;contact:string;includeName:boolean};
const fresh=():Payload=>({category:'experience',subject:'',message:'',contact:'',includeName:false});
const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function mountFeedback(o:{pause(v:boolean):void;canUse():boolean}){
 const dialog=document.createElement('dialog');dialog.className='play-dialog feedback-dialog';dialog.setAttribute('aria-labelledby','feedback-title');document.body.append(dialog);
 let owner='',draft=fresh(),pending:{key:string;body:Payload}|null=null,busy=false,notice='',sent=false,storageFailed=false,focus:HTMLElement|null=null;
 const storageKey=()=>`vju2011-feedback-v1:${owner}`;
 function save(){try{sessionStorage.setItem(storageKey(),JSON.stringify({draft,pending}));}catch{storageFailed=true;}}
 function load(){owner=currentParticipant()?.id||'none';draft=fresh();pending=null;notice='';sent=false;try{const raw=JSON.parse(sessionStorage.getItem(storageKey())||'null');if(raw&&typeof raw.draft?.message==='string'){draft={...fresh(),...raw.draft};if(raw.pending?.body&&typeof raw.pending.key==='string')pending=raw.pending;}}catch{storageFailed=true;}}
 function fit(){const v=window.visualViewport;dialog.style.maxHeight=`${(v?.height||innerHeight)-16}px`;dialog.style.top=`${v?.offsetTop||0}px`;}
 window.visualViewport?.addEventListener('resize',fit);window.visualViewport?.addEventListener('scroll',fit);
 function render(){
  dialog.innerHTML=`<header><h2 id="feedback-title">${tr('Hộp thư góp ý')}</h2><button type="button" data-close aria-label="${tr('Đóng góp ý')}">×</button></header><div class="play-body"><p>${tr('Gửi riêng tới ban quản trị VJU2011. Không hiện trên Bảng Tri Ân, không trừ lượt gửi lời cảm ơn.')}</p><p role="status" class="feedback-notice">${esc(notice)}</p>${sent?`<button type="button" data-new>${tr('Viết góp ý khác')}</button>`:`<form><fieldset ${busy||pending?'disabled':''}><label>${tr('Về vấn đề')}<select name="category">${[['experience',tr('Trải nghiệm campus')],['bug',tr('Báo lỗi')],['idea',tr('Đề xuất cải thiện')],['other',tr('Khác')]].map(([v,t])=>`<option value="${v}" ${draft.category===v?'selected':''}>${t}</option>`).join('')}</select></label><label data-other-topic ${draft.category==='other'?'':'hidden'}>${tr('Em hãy nêu rõ vấn đề cần góp ý')}<input name="subject" maxlength="120" ${draft.category==='other'?'required':''} value="${esc(draft.subject)}" placeholder="${tr('Ví dụ: Biển chỉ dẫn ở khu nhà khách')}"></label><label>${tr('Nội dung')} <small>${tr('10–2.000 ký tự')}</small><textarea name="message" rows="5" minlength="10" maxlength="2000" required placeholder="${tr('Bạn gặp điều gì, ở đâu? Bạn mong muốn thay đổi thế nào?')}">${esc(draft.message)}</textarea></label><label>${tr('Liên hệ để nhận phản hồi')} <small>${tr('không bắt buộc')}</small><input name="contact" maxlength="120" value="${esc(draft.contact)}" placeholder="${tr('Email hoặc cách liên hệ')}" autocomplete="off"></label>${currentParticipant()?.mode!=='anonymous'?`<label class="feedback-check"><input type="checkbox" name="includeName" ${draft.includeName?'checked':''}>${tr('Kèm tên hiển thị của tôi')}</label>`:''}</fieldset><p class="feedback-storage">${storageFailed?tr('Trình duyệt không lưu được bản nháp; hãy giữ trang này mở.'):tr('Bản nháp chỉ giữ trong tab này. Không nhập mật khẩu hoặc dữ liệu nhạy cảm.')}</p>${pending?`<p>${tr('Nội dung đang chờ xác nhận. Thử lại sẽ dùng cùng mã gửi để tránh trùng góp ý.')}</p>`:''}<div class="play-actions"><button type="submit" ${busy?'disabled':''}>${busy?tr('Đang gửi…'):pending?tr('Thử gửi lại'):tr('Gửi góp ý')}</button>${!pending?`<button type="button" data-clear>${tr('Xóa bản nháp')}</button>`:''}</div></form>`}</div>`;
  dialog.querySelector('[data-close]')!.addEventListener('click',()=>dialog.close());
  dialog.querySelector('[data-new]')?.addEventListener('click',()=>{sent=false;notice='';render();});
  dialog.querySelector('[data-clear]')?.addEventListener('click',()=>{draft=fresh();save();render();});
  const form=dialog.querySelector('form');
  form?.addEventListener('input',()=>{const data=new FormData(form);draft={category:String(data.get('category')),subject:String(data.get('subject')||''),message:String(data.get('message')),contact:String(data.get('contact')),includeName:data.has('includeName')};save();});
  form?.querySelector('[name=category]')?.addEventListener('change',()=>{const field=form.querySelector<HTMLInputElement>('[name=subject]')!;field.required=draft.category==='other';field.closest('label')!.hidden=!field.required;});
  form?.addEventListener('submit',e=>{e.preventDefault();void submit();});
 }
 async function submit(){
  if(busy)return;if(owner!==currentParticipant()?.id){notice=tr('Danh tính đã thay đổi. Hãy đóng và mở lại hộp thư.');render();return;}
  pending??={key:crypto.randomUUID(),body:{...draft,subject:draft.category==='other'?draft.subject:''}};save();busy=true;notice='';render();
  try{
   const response=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':pending.key},body:JSON.stringify(pending.body),signal:requestTimeout(15000)});
   if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Chưa xác nhận được kết quả gửi.');
   const data=await response.json();
   if(!response.ok){if(response.status>=400&&response.status<500&&response.status!==408){pending=null;save();}throw Error(data.error||tr('Chưa gửi được góp ý.'));}
   if(typeof data.id!=='string')throw Error('Chưa xác nhận được kết quả gửi.');
   pending=null;draft=fresh();save();sent=true;notice=tr('Đã nhận góp ý. Cảm ơn bạn đã giúp campus tốt hơn!');
  }catch(e){notice=trServer((e as Error).message);}
  finally{busy=false;if(dialog.open)render();}
 }
 dialog.addEventListener('keydown',e=>e.stopPropagation());
 dialog.addEventListener('close',()=>{o.pause(false);focus?.focus();});
 return {isOpen:()=>dialog.open,open(){if(dialog.open||!o.canUse())return;if(!busy)load();focus=document.activeElement as HTMLElement;o.pause(true);fit();render();dialog.showModal();}};
}
