import {tr,trServer} from '../i18n/index.ts';
import '../style.css';
import './reflections.css';
import {api,esc,formatDate,mountShell,reflectionCard,type Reflection} from './shared';

const root=mountShell(false),library=location.pathname.replace(/\/$/,'')==='/suy-ngam/thu-vien';
let generation=0;
async function load(){
 const request=++generation;root.setAttribute('aria-busy','true');
 try{
  if(library){
   const p=new URLSearchParams(location.search).get('page')||'0';
   const data=await api<{items:Reflection[];page:number;pages:number;total:number}>('/api/reflections/library?page='+encodeURIComponent(p));if(request!==generation)return;
   root.innerHTML=`<div class="reflection-section-heading"><h2>${tr('Thư viện suy ngẫm')}</h2><span>${tr('{0} nội dung đã hiển thị trước hôm nay',{0:data.total})}</span></div>${data.items.length?`<ol class="reflection-library">${data.items.map(item=>`<li><time datetime="${esc(item.displayDate)}">${formatDate(item.displayDate)}</time><div><p class="reflection-topic">${esc(item.topic)} · ${item.quoteType==='verbatim'?tr('Nguyên văn'):tr('Diễn giải')}</p><h3><a href="/suy-ngam?id=${esc(item.id)}">${esc(item.content)}</a></h3><p>${esc(item.author)}</p></div></li>`).join('')}</ol><nav class="reflection-pagination" aria-label="${tr('Trang thư viện')}">${data.page>0?`<a href="?page=${data.page-1}">${tr('← Trước')}</a>`:''}<span>${tr('Trang {0} / {1}',{0:data.page+1,1:data.pages})}</span>${data.page+1<data.pages?`<a href="?page=${data.page+1}">${tr('Sau →')}</a>`:''}</nav>`:`<section class="reflection-empty"><h3>${tr('Thư viện đang chờ những suy ngẫm đầu tiên')}</h3><p>${tr('Các nội dung đã xuất bản sẽ được lưu tại đây sau ngày hiển thị.')}</p><a href="/suy-ngam">${tr('Về suy ngẫm hôm nay')}</a></section>`}`;
  }else{
   const id=new URLSearchParams(location.search).get('id');
   const data=await api<{reflection:Reflection|null;date?:string}>(id?'/api/reflections/'+encodeURIComponent(id):'/api/reflections/today');if(request!==generation)return;
   root.innerHTML=`<div class="reflection-section-heading"><p>${id?`<a href="/suy-ngam/thu-vien">${tr('← Thư viện suy ngẫm')}</a>`:tr('Suy ngẫm hôm nay')}</p><time datetime="${esc(data.reflection?.displayDate||data.date)}">${formatDate(data.reflection?.displayDate||data.date||null)}</time></div>${data.reflection?reflectionCard(data.reflection):`<section class="reflection-empty"><h2>${tr('Hôm nay chưa có nội dung được công bố')}</h2><p>${tr('Bạn có thể ghé thư viện để đọc lại những suy ngẫm trước đây.')}</p><a href="/suy-ngam/thu-vien">${tr('Mở thư viện suy ngẫm →')}</a></section>`}`;
  }
 }catch(e){if(request!==generation)return;root.innerHTML=`<section class="reflection-empty" role="alert"><h2>${tr('Chưa thể mở nội dung')}</h2><p>${esc(trServer((e as Error).message))}</p><button id="reflection-retry">${tr('Thử lại')}</button></section>`;root.querySelector('#reflection-retry')?.addEventListener('click',()=>void load());}
 finally{if(request===generation){root.setAttribute('aria-busy','false');document.body.dataset.ready='true';}}
}
void load();
// Refresh at the Vietnam day boundary, including a tab left open overnight.
let day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());
function refreshDate(){if(document.hidden)return;const next=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());if(next!==day){day=next;void load();}}
setInterval(refreshDate,30000);document.addEventListener('visibilitychange',refreshDate);
