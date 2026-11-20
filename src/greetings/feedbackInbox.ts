import {requestTimeout} from '../browserCompat';
import {tr,trServer} from '../i18n/index.ts';
import '../play/feedback.css';
type Entry={id:string;category:string;subject?:string;message:string;contact:string;displayName:string;createdAt:number};
const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function createFeedbackInbox(o:{headers():Record<string,string>;render():void;active():boolean}){
 let entries:Entry[]=[],status='new',page=0,total=0,busy=false,loaded=false,error='',epoch=0;
 async function load(change?:{id:string;status:string}){
  if(busy||!o.active())return;busy=true;error='';const generation=epoch;o.render();
  try{
   const request=async(path:string,body?:unknown)=>{
    const res=await fetch(path,{method:body?'POST':'GET',headers:{...o.headers(),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:requestTimeout(15000)});
    const data=await res.json();if(!res.ok)throw Error(data.error||tr('Chưa tải được góp ý.'));return data;
   };
   if(change)await request('/api/admin/feedback/'+encodeURIComponent(change.id),{status:change.status});
   const data=await request(`/api/admin/feedback?status=${status}&page=${page}`);
   if(epoch!==generation||!o.active())return;entries=data.entries;total=data.total;loaded=true;
  }catch(e){if(epoch===generation)error=trServer((e as Error).message);}
  finally{if(epoch===generation){busy=false;if(o.active())o.render();}}
 }
 return {
  clear(){epoch++;entries=[];total=0;page=0;busy=false;loaded=false;error='';},
  markup(){return `<section class="feedback-inbox"><h3>${tr('Hộp thư góp ý')}</h3><p class="vg-muted">${tr('Nội dung riêng cho admin/mod. Không xuất bản lên bảng lời chúc.')}</p><button type="button" data-feedback-load ${busy?'disabled':''}>${busy?tr('Đang tải…'):loaded?tr('Làm mới góp ý'):tr('Xem góp ý')}</button><label>${tr('Trạng thái góp ý')}<select data-feedback-filter ${busy?'disabled':''}><option value="new" ${status==='new'?'selected':''}>${tr('Mới nhận')}</option><option value="done" ${status==='done'?'selected':''}>${tr('Đã xử lý')}</option></select></label><p role="status">${esc(error)}</p>${entries.map(e=>`<article><strong>${esc(({bug:tr('Báo lỗi'),experience:tr('Trải nghiệm campus'),idea:tr('Đề xuất cải thiện'),other:tr('Khác')} as Record<string,string>)[e.category])}</strong>${e.subject?`<h4>${esc(e.subject)}</h4>`:''}<p>${esc(e.message)}</p><p class="vg-muted">${esc(e.displayName||tr('Không kèm tên'))} · ${esc(new Date(e.createdAt).toLocaleString('vi-VN'))}</p>${e.contact?`<p>${tr('Liên hệ: {0}',{0:esc(e.contact)})}</p>`:''}<button type="button" data-feedback-id="${esc(e.id)}" ${busy?'disabled':''}>${status==='new'?tr('Đánh dấu đã xử lý'):tr('Mở lại góp ý')}</button></article>`).join('')}${loaded&&!entries.length?`<p>${tr('Không có góp ý trong trạng thái này.')}</p>`:''}${loaded?`<div class="feedback-pager"><button type="button" data-feedback-page="-1" ${busy||page===0?'disabled':''}>${tr('Trước')}</button><span>${tr('{0} góp ý · Trang {1}',{0:total,1:page+1})}</span><button type="button" data-feedback-page="1" ${busy||(page+1)*25>=total?'disabled':''}>${tr('Sau')}</button></div>`:''}</section>`;},
  bind(root:HTMLElement){
   root.querySelector('[data-feedback-load]')?.addEventListener('click',()=>void load());
   root.querySelector<HTMLSelectElement>('[data-feedback-filter]')?.addEventListener('change',e=>{status=(e.target as HTMLSelectElement).value;page=0;entries=[];void load();});
   root.querySelectorAll<HTMLButtonElement>('[data-feedback-id]').forEach(b=>b.onclick=()=>void load({id:b.dataset.feedbackId!,status:status==='new'?'done':'new'}));
   root.querySelectorAll<HTMLButtonElement>('[data-feedback-page]').forEach(b=>b.onclick=()=>{page+=Number(b.dataset.feedbackPage);void load();});
  }
 };
}
