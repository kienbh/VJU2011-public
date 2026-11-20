import {tr,LANG} from '../i18n/index.ts';
import {journalDate,type Journal} from './journalModel';
import {JOURNAL_ACTIVITIES} from './journal';
const esc=(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const time=(n:number)=>new Date(n).toLocaleTimeString(LANG==='ja'?'ja-JP':'vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'});
function duration(ms:number){const sec=Math.floor(ms/1000),min=Math.floor(sec/60);return sec<60?tr('{0} giây',{0:sec}):min<60?tr('{0} phút {1} giây',{0:min,1:sec%60}):tr('{0} giờ {1} phút',{0:Math.floor(min/60),1:min%60});}
export function journalPanel(data:Journal,selected:string,durable:boolean){
 const today=journalDate(Date.now()),dates=[...new Set([today,...Object.keys(data.days)])].sort().reverse(),id=dates.includes(selected)?selected:today;
 const day=data.days[id],areas=Object.entries(day?.areas||{}).sort((a,b)=>b[1]-a[1]),activities=Object.entries(day?.activities||{}),total=areas.reduce((n,[,ms])=>n+ms,0);
 return `<div class="journal-toolbar"><label>${tr('Ngày')} <select data-journal-day>${dates.map(d=>`<option value="${d}" ${d===id?'selected':''}>${d===today?tr('Hôm nay'):d.split('-').reverse().join('/')}</option>`).join('')}</select></label><button data-journal-refresh>${tr('Cập nhật')}</button></div>
 <div class="journal-summary"><strong>${duration(total)}</strong><span>${tr('trong campus · {0} khu vực',{0:areas.length})}</span></div>
 <h3>${tr('Bạn đã chơi & trải nghiệm')}</h3>${activities.length?`<div class="journal-activities">${activities.map(([a,n])=>`<div><span>${esc(JOURNAL_ACTIVITIES[a]||a)}</span><strong>${tr('{0} lượt',{0:n})}</strong></div>`).join('')}</div>`:`<p>${tr('Chưa có hoạt động được ghi nhận. Thử sút bóng, cho cá ăn hoặc nhặt rác nhé.')}</p>`}
 <h3>${tr('Thời gian ở từng khu vực')}</h3>${areas.length?`<ul class="journal-areas">${areas.map(([name,ms])=>`<li><span>${esc(name)}</span><strong>${duration(ms)}</strong></li>`).join('')}</ul>`:`<p>${tr('Đi dạo campus để bắt đầu nhật ký.')}</p>`}
 ${day?.events.length?`<details><summary>${tr('Hoạt động gần đây')}</summary><ol class="journal-events">${[...day.events].reverse().map(e=>`<li><time>${time(e.at)}</time><div><strong>${esc(JOURNAL_ACTIVITIES[e.activity]||e.activity)}</strong><span>${esc(e.area)}</span></div></li>`).join('')}</ol></details>`:''}
 ${day?.visits.length?`<details><summary>${tr('Các lần ghé gần đây')}</summary><ol class="journal-events">${[...day.visits].reverse().slice(0,20).map(v=>`<li><time>${time(v.at)}</time><div><strong>${esc(v.area)}</strong><span>${duration(v.ms)}</span></div></li>`).join('')}</ol></details>`:''}
 <p class="journal-note">${durable?tr('Nhật ký riêng trên trình duyệt này · 7 ngày gần nhất.'):tr('Trình duyệt không hỗ trợ lưu an toàn: nhật ký chỉ giữ trong tab này.')} ${tr('Thời gian tính khi đang ở campus và tab được sử dụng; dừng khi ẩn tab hoặc rời campus. Chỉ ghi từ lúc tính năng được bật.')}</p>`;
}
