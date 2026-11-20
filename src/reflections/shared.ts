import {tr} from '../i18n/index.ts';
export type Reflection = {
 id:string;topic:string;content:string;author:string;sourceBook:string;sourceReference:string;sourceUrl:string;sourcePages:string;attributionNote:string;
 quoteType:'verbatim'|'paraphrase';question:string;displayDate:string|null;
};
export type Editorial = Reflection & {status:'draft'|'pending'|'approved'|'published'|'archived';sourceVerified:boolean;contentOrigin:'editorial'|'ai_assisted'|'demo';revision:number;createdAt:string;updatedAt:string;approvedAt:string|null;publishedAt:string|null};
export const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const formatDate=(date:string|null)=>date?new Intl.DateTimeFormat('vi-VN',{dateStyle:'long',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(date+'T12:00:00+07:00')):tr('Chưa xếp ngày');
export const statusLabel={draft:tr('Nháp'),pending:tr('Chờ duyệt'),approved:tr('Đã duyệt'),published:tr('Đã xuất bản / xếp lịch'),archived:tr('Đã gỡ')};
export async function api<T>(path:string,token='',body?:unknown):Promise<T>{
 const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:{Accept:'application/json',...(token?{Authorization:`Bearer ${token}`} :{}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Máy chủ chưa trả về dữ liệu. Vui lòng thử lại.');
 const data=await response.json();if(!response.ok)throw Error(data.error||tr('Không thể tải nội dung. Vui lòng thử lại.'));return data;
}
export function reflectionCard(item:Reflection,preview=false){
 let sourceLink='';try{const u=new URL(item.sourceUrl);if(['https:','http:'].includes(u.protocol))sourceLink=`<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${tr('Mở nguồn tham chiếu ↗')}</a>`;}catch{/* No link when source is absent. */}
 const statement=item.quoteType==='verbatim'?`<blockquote class="reflection-statement">“${esc(item.content)}”</blockquote>`:`<p class="reflection-statement">${esc(item.content)}</p>`;
 return `<article class="reflection-card" aria-label="${tr('Suy ngẫm về {0}',{0:esc(item.topic)})}">
  <div class="reflection-meta"><p class="reflection-topic">${tr('GÓC SUY NGẪM · {0}',{0:esc(item.topic)})}</p><span class="reflection-type">${item.quoteType==='verbatim'?tr('Nguyên văn'):tr('Diễn giải')}</span></div>
  ${preview?`<p class="reflection-preview-note">${tr('Bản xem trước · chưa phải nội dung công khai')}</p>`:''}
  ${statement}
  <div class="reflection-attribution"><p>${item.quoteType==='paraphrase'?tr('Diễn giải tư tưởng của'):tr('Tác giả')} <strong>${esc(item.author)}</strong>${item.quoteType==='paraphrase'?tr(' · Không phải nguyên văn'):''}</p>${item.attributionNote?`<p>${esc(item.attributionNote)}</p>`:''}</div>
  <div class="reflection-source"><span>${tr('Nguồn tham chiếu')}</span><p>${item.sourceBook?`<cite>${esc(item.sourceBook)}</cite>`:''}${item.sourcePages?tr(' · Trang / vị trí: {0}',{0:esc(item.sourcePages)}):''}${!item.sourceBook&&!item.sourceReference?tr('Chưa bổ sung nguồn tham chiếu.'):''}</p>${item.sourceReference?`<p>${esc(item.sourceReference)}</p>`:''}${sourceLink}</div>
  <section class="reflection-question" aria-label="${tr('Suy ngẫm hôm nay')}"><h2>${tr('Suy ngẫm hôm nay')}</h2><p>${esc(item.question)}</p></section>
 </article>`;
}
export function mountShell(admin:boolean){
 document.body.classList.add('reflection-page');document.title=admin?tr('Biên tập suy ngẫm · VJU'):tr('Góc suy ngẫm – Nghề thầy · VJU');
 document.querySelector<HTMLDivElement>('#app')!.innerHTML=`<a class="reflection-skip" href="#reflection-main">${tr('Đến nội dung')}</a>
 <header class="masthead"><a class="brand" href="/" aria-label="${tr('Về sân trường VJU')}"><img class="brand-logo" src="/assets/brand/project-mark.svg" alt="20.11" width="138" height="52"><div><span class="eyebrow">${tr('DÀNH CHO GIẢNG VIÊN')}</span><p>${tr('Góc suy ngẫm')}</p></div></a><nav class="reflection-nav" aria-label="${tr('Điều hướng suy ngẫm')}"><a href="/suy-ngam" ${!admin&&!location.pathname.includes('thu-vien')?'aria-current="page"':''}>${tr('Hôm nay')}</a><a href="/suy-ngam/thu-vien" ${location.pathname.includes('thu-vien')?'aria-current="page"':''}>${tr('Thư viện')}</a><a href="/">${tr('Về sân trường')}</a></nav></header>
 <main id="reflection-main" tabindex="-1"><div class="reflection-heading"><p class="reflection-eyebrow">${admin?tr('KHÔNG GIAN BIÊN TẬP'):tr('MỖI NGÀY, MỘT ĐIỀU ĐỂ NGẪM')}</p><h1>${admin?tr('Biên tập góc suy ngẫm'):tr('Góc suy ngẫm – Nghề thầy')}</h1><p>${admin?tr('Chuẩn bị nội dung, đối chiếu nguồn và duyệt trước khi xuất bản.'):tr('Một khoảng lặng để nghĩ về việc dạy, việc học và những điều còn ở lại.')}</p></div><p id="reflection-feedback" role="status" aria-live="polite"></p><div id="reflection-content" aria-busy="true"><p>${tr('Đang tải nội dung…')}</p></div></main>
 <footer class="reflection-footer"><span>${tr('VJU · Góc suy ngẫm dành cho giảng viên')}</span><a href="/suy-ngam/quan-tri">${tr('Biên tập nội dung')}</a></footer>`;
 return document.querySelector<HTMLDivElement>('#reflection-content')!;
}
