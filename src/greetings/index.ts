import {requestTimeout} from '../browserCompat';
import {tr,tName,trServer,minMessageLength} from '../i18n/index.ts';
import {createFeedbackInbox} from './feedbackInbox';
import {mountSharedGarden} from './sharedGarden';
import {currentParticipant} from './participation';
import {readFlowerLoop,advanceFlowerLoop,pickFlower as takeFlower,type FlowerLoopState} from '../festival/flowerLoop';
import './greetings.css';
import {readApiResponse} from './apiResponse';
import { BOUQUET_SIZE,FLOWERS,isFlower,readFlowers,bouquetMarkup,bouquetDescription,type FlowerKind } from './flowers';
import { gardenMarkup } from './gardenMarkup';
import type { FestivalConfig, Gift, GreetingsOptions, PublicGreeting, Visibility } from './types';
export type { FestivalConfig, PublicGreeting } from './types';

type Draft = { recipientName?: string; bookTitle?: string; bookAuthor?: string; recipientId: string; message: string; signature: string; className: string; visibility: Visibility; gift: Gift; bouquet?: FlowerKind[]; key: string };
type Receipt = { id: string; receiptToken: string; status: string; visibility?: string; recipientName?: string; bouquet?: FlowerKind[] };
type AdminGreeting = PublicGreeting & { visibility: string; status: string; garden?:{sequence:number;page:number;slot:number} };
const draftKey = 'vju2011-greeting-draft-v1';
const receiptKey = 'vju2011-receipt-v1';
const basketKey = 'vju2011-flower-basket-v1';
const gifts: Record<Gift, string> = { none: tr('Chỉ lời chúc'), flowers: tr('Một bó hoa'), book: tr('Một cuốn sách'), tea: tr('Một tách trà'), coffee: tr('Một tách cà phê') };
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const uuid = () => crypto.randomUUID();
const emptyDraft = (): Draft => ({ recipientId: 'general', message: '', signature: '', className: '', visibility: 'public', gift: 'none', key: uuid() });
function readDraft(): Draft {
  try {
    const value = JSON.parse(localStorage.getItem(draftKey) || 'null');
    if (!value || typeof value.message !== 'string') return emptyDraft();
    return { recipientName:String(value.recipientName||'').slice(0,120),bookTitle:String(value.bookTitle||'').slice(0,160),bookAuthor:String(value.bookAuthor||'').slice(0,120),recipientId: typeof value.recipientId === 'string' ? value.recipientId : 'general', message: value.message.slice(0, 1000), signature: String(value.signature || '').slice(0, 80), className: String(value.className || '').slice(0, 80), visibility: value.visibility === 'public' ? 'public' : 'private', gift: value.gift in gifts ? value.gift : 'none', bouquet:value.gift==='flowers'&&readFlowers(value.bouquet).length===BOUQUET_SIZE?readFlowers(value.bouquet):undefined, key: typeof value.key === 'string' ? value.key : uuid() };
  } catch { return emptyDraft(); }
}
const statusText = (status: string) => ({ pending: tr('Đang chờ duyệt'), approved: tr('Đã được duyệt'), rejected: tr('Không được duyệt') }[status] || status);

export function mountGreetings(options: GreetingsOptions) {
  let config: FestivalConfig | null = null;
  let cards: PublicGreeting[] = [];
  let draft = readDraft();
  const account=currentParticipant();
  if(account?.mode==='anonymous'){draft.signature='Khách ẩn danh';draft.className='';}
  else if(account&&!draft.signature)draft.signature=account.name;
  let basket:FlowerKind[]=[];
  try{basket=readFlowers(JSON.parse(localStorage.getItem(basketKey)||'[]'));}catch{/* optional storage */}
  const flowerKey='vju2011-flower-loop-v1';
  let flowerState:FlowerLoopState=readFlowerLoop(null,Date.now(),basket);
  try{flowerState=readFlowerLoop(JSON.parse(localStorage.getItem(flowerKey)||'null'),Date.now(),basket);}catch{/* local demo */}
  basket=[...flowerState.basket];
  const sharedGarden=mountSharedGarden({local:()=>flowerState,pause:options.onOpenChange,view:slot=>options.onViewFlower?.(slot),consume(flowers){
    const remaining=[...basket];for(const kind of flowers){const i=remaining.indexOf(kind);if(i>=0)remaining.splice(i,1);}basket=remaining;flowerState={...flowerState,basket};saveBasket();
  }});
  let receipt: Receipt | null = null;
  try { receipt = JSON.parse(sessionStorage.getItem(receiptKey) || 'null'); } catch { /* Storage may be unavailable. */ }
  let tab: 'board' | 'garden' | 'compose' | 'admin' = 'board';
  // Arriving with flowers in hand (RPG bag, garden bed): planting comes before picking.
  let plantFirst = false;
  let stage: 'edit' | 'preview' | 'receipt' = receipt ? 'receipt' : 'edit';
  let sending = false;
  let refreshing = false;
  let adminToken = '';
  let adminRole: 'admin'|'moderator'|null = null;
  const adminHeaders = ():Record<string,string> => adminToken ? {Authorization:`Bearer ${adminToken}`} : {};
  const feedbackInbox=createFeedbackInbox({headers:adminHeaders,render:()=>render(),active:()=>dialog.open&&tab==='admin'&&!!(adminRole||adminToken)});
  let adminCards: AdminGreeting[] = [];
  let adminStatus = 'pending';
  let adminSource:'all'|'garden'='all';
  let gardenEdit:AdminGreeting|null=null;
  let gardenEditExpected:{signature:string;recipientName:string;message:string}|null=null;
  let adminBusy = false;
  let adminSession = 0;
  let adminRequest = 0;
  let message = '';
  let messageIsError = false;
  let lastFocus: HTMLElement | null = null;
  let refreshProblem = '';
  let storageProblem = false;
  const confirmed = new Set<string>();
  const dialog = document.createElement('dialog');
  dialog.className = 'vju-greetings';
  dialog.setAttribute('aria-labelledby', 'vju-greetings-title');
  document.body.append(dialog);
  const fitDialog=()=>dialog.style.setProperty('--visual-height',`${window.visualViewport?.height??innerHeight}px`);
  fitDialog();window.visualViewport?.addEventListener('resize',fitDialog);

  const api = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    let response: Response;
    try { response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers }, signal: requestTimeout(15000) }); }
    catch { throw new Error('Chưa kết nối được máy chủ. Bản nháp vẫn được giữ; bạn có thể thử lại.'); }
    return await readApiResponse(response,path) as T;
  };
  const saveDraft = () => {
    try { localStorage.setItem(draftKey, JSON.stringify(draft)); storageProblem = false; }
    catch { storageProblem = true; }
    const status = dialog.querySelector<HTMLElement>('.vg-storage');
    if (status && storageProblem) status.textContent = tr('Trình duyệt không lưu được bản nháp; hãy giữ cửa sổ này mở.');
  };
  const notify = (text: string, error = false) => {
    message = text; messageIsError = error;
    const node = dialog.querySelector<HTMLElement>('.vg-feedback');
    if (node) { node.textContent = text; node.classList.toggle('vg-error', error); }
  };
  function saveBasket(){flowerState={...flowerState,basket:[...basket]};try{localStorage.setItem(flowerKey,JSON.stringify(flowerState));localStorage.setItem(basketKey,JSON.stringify(basket));storageProblem=false;}catch{storageProblem=true;}}
  function pickFlower(kind:FlowerKind){
    if(sending)return tr('Thiệp đang gửi, hãy đợi xác nhận.');
    if(!isFlower(kind))return '';
    if(basket.length>=BOUQUET_SIZE)return tr('Bạn đã hái đủ 5 bông. Hãy chọn ô trồng hoặc đính kèm thiệp.');
    const picked=takeFlower(flowerState,kind,Date.now());flowerState=picked.state;if(!picked.ok)return tr('Luống này đang hồi hoa. Thử lại sau nhịp 60 giây.');basket=[...flowerState.basket];saveBasket();window.dispatchEvent(new Event('vju-flower-success'));
    const text=tr('Đã hái {0} · {1}/5 bông.',{0:FLOWERS[kind].name.toLowerCase(),1:basket.length});
    notify(text);if(dialog.open&&tab==='garden')render(`[data-pick="${kind}"]`);return text;
  }
  const recipientName = () => ['teacher','other'].includes(draft.recipientId)?draft.recipientName||'':draft.recipientId==='general'?tr('Tập thể thầy cô và cán bộ nhân viên VJU'):config?.recipients.find(r=>r.id===draft.recipientId)?.name||'';
  const cardMarkup = (card: PublicGreeting) => `<article class="vg-card"><div class="vg-card-top"><span class="vg-card-recipient">${esc(tName(card.recipientName))}</span>${card.isSample ? `<b class="vg-sample">${tr('THIỆP MẪU')}</b>` : ''}</div><p class="vg-card-message">${esc(card.message)}</p><button type="button" class="vg-card-more" aria-expanded="false" hidden>${tr('Xem thêm')}</button><div class="vg-signature">${esc(tName(card.signature||'') || tr('Một người gửi lời cảm ơn'))}${card.className ? ` · ${esc(card.className)}` : ''}</div>${card.gift==='flowers'&&readFlowers(card.bouquet).length?`<div class="vg-card-bouquet">${bouquetMarkup(readFlowers(card.bouquet),true)}<span>${esc(bouquetDescription(readFlowers(card.bouquet)))}</span></div>`:''}<span class="vg-gift">${esc(gifts[card.gift] || gifts.none)}${card.gift==='book'&&card.bookTitle?`: ${esc(card.bookTitle)} — ${esc(card.bookAuthor)}`:''}</span></article>`;

  function render(focusSelector?: string) {
    const focused = document.activeElement as HTMLElement | null;
    const restoreFocus = focusSelector || (focused && dialog.contains(focused) ? focused.dataset.tab ? `[data-tab="${focused.dataset.tab}"]` : focused.dataset.action ? `[data-action="${focused.dataset.action}"]` : focused.classList.contains('vg-close') ? '.vg-close' : undefined : undefined);
    const accepting = !!config?.event.acceptingSubmissions;
    dialog.innerHTML = `<div class="vg-shell"><header class="vg-header"><div><h2 id="vju-greetings-title">${tr('Một lời cảm ơn, gửi thầy cô.')}</h2></div><button class="vg-close" type="button" aria-label="${tr('Đóng bảng lời chúc')}">×</button></header><div class="vg-mode">${config ? `${tr('LỜI CHÚC TRI ÂN')} · ${approvalHint()}` : (refreshProblem?tr('Chưa kết nối · Bản nháp vẫn được giữ'):tr('Đang kiểm tra kết nối…'))}${config && !accepting ? tr(' · Tạm ngừng nhận thiệp') : ''}</div><nav class="vg-tabs" aria-label="${tr('Bảng lời chúc')}"><button data-tab="board" aria-current="${tab === 'board' ? 'page' : 'false'}">${tr('Bảng tri ân')} <span>${cards.length}</span></button><button data-tab="garden" aria-current="${tab === 'garden' ? 'page' : 'false'}">${tr('Hái hoa')}</button><button data-tab="compose" aria-current="${tab === 'compose' ? 'page' : 'false'}">${tr('Viết thiệp')}</button>${(options.showAdmin||adminRole)?`<button data-tab="admin" aria-current="${tab === 'admin' ? 'page' : 'false'}">${tr('Quản trị')}</button>`:''}</nav><div class="vg-feedback ${messageIsError ? 'vg-error' : ''}" role="status" aria-live="polite">${esc(message)}</div><main class="vg-content">${tab === 'board' ? boardMarkup() : tab === 'garden' ? (plantFirst?plantingMarkup()+gardenMarkup(basket,!!draft.bouquet,storageProblem,true):gardenMarkup(basket,!!draft.bouquet,storageProblem)+plantingMarkup()) : tab === 'compose' ? composeMarkup() : adminMarkup()}</main><footer class="vg-footer">${approvalHint()}. ${tr('Thiệp riêng không hiển thị trên bảng.') }</footer></div>`;
    bind();
    if(tab==='admin')feedbackInbox.bind(dialog);
    dialog.querySelector('h3')?.setAttribute('tabindex', '-1');
    if (restoreFocus) dialog.querySelector<HTMLElement>(restoreFocus)?.focus();
  }
  function plantingMarkup(){return `<section class="vg-planting"><h3>${tr('Vườn Hoa Tri Ân')}</h3><p>${tr('Mỗi tài khoản hoặc lượt khách được gửi tổng cộng 3 lời cảm ơn, tính cả thiệp và chậu hoa. Xem vị trí và trạng thái hoa của bạn.')}</p><button type="button" id="vg-shared-garden">${tr('Mở vườn hoa / Hoa của tôi')}</button></section>`;}

  function boardMarkup() {
    return `<div class="vg-section-title"><div><h3>${tr('Những điều muốn gửi')}</h3><p>${refreshProblem ? esc(refreshProblem) : tr('Thiệp đã được duyệt')}</p></div><button type="button" data-action="refresh">${tr('Làm mới')}</button></div>${cards.length ? `<div class="vg-board">${cards.map(cardMarkup).join('')}</div>` : `<div class="vg-empty"><span>✉</span><h3>${tr('Khoảng trống dành cho lời cảm ơn.')}</h3><p>${tr('Chưa có thiệp công khai đã được duyệt. Bạn có thể gửi một lời chúc riêng hoặc đề nghị chia sẻ lên bảng.')}</p><button class="vg-primary" data-action="write">${tr('Viết thiệp đầu tiên')}</button></div>`}`;
  }
  const approvalHint=()=>config?.event.autoApprove===true?tr('Công khai ngay sau khi gửi'):tr('Công khai sau khi duyệt');
  function composeMarkup() {
    if(account&&account.used>=3&&stage==='edit')return `<section><h3>${tr('Bạn đã gửi đủ 3 lời cảm ơn')}</h3><p>${tr('Cảm ơn bạn đã tham gia. Bạn vẫn có thể dạo sân, xem thiệp, ngắm hoa và kết lễ.')}</p><button type="button" data-action="garden">${tr('Xem vườn hoa')}</button></section>`;
    if (stage === 'receipt' && receipt) return `<section class="vg-receipt"><div class="vg-confirmed-flower" role="img" aria-label="${tr('Hoa xác nhận thiệp đã được tiếp nhận')}"><svg viewBox="0 0 120 110" aria-hidden="true"><path d="M60 103V53M60 85Q28 57 31 85Q46 102 60 93M60 76Q91 48 89 78Q75 94 60 85" fill="#607f50" stroke="#607f50" stroke-width="3"/><g fill="#d78473"><ellipse cx="60" cy="27" rx="13" ry="24"/><ellipse cx="60" cy="27" rx="13" ry="24" transform="rotate(72 60 48)"/><ellipse cx="60" cy="27" rx="13" ry="24" transform="rotate(144 60 48)"/><ellipse cx="60" cy="27" rx="13" ry="24" transform="rotate(216 60 48)"/><ellipse cx="60" cy="27" rx="13" ry="24" transform="rotate(288 60 48)"/></g><circle cx="60" cy="48" r="12" fill="#e9bf6d"/></svg></div><h3>${tr('Máy chủ đã nhận thiệp của bạn.')}</h3><p>${tr('Dành tặng:')} <strong>${esc(tName(receipt.recipientName||'')||tr('Thầy cô VJU'))}</strong></p><p>${tr('Trạng thái:')} <strong>${esc(statusText(receipt.status))}</strong></p><p class="vg-muted">${tr('Đây là xác nhận của máy chủ, chưa phải xác nhận thầy cô đã nhận hoặc đọc. Thiệp công khai được đọc tại Bảng Tri Ân; hiện không gửi email tự động.')}</p><p>${receipt.visibility === 'public' ? (receipt.status==='approved'?tr('Thiệp đã được công khai trên Bảng Tri Ân.'):receipt.status==='pending'?tr('Thiệp sẽ lên bảng sau khi quản trị viên duyệt.'):tr('Thiệp không được công khai trên bảng.')) : tr('Thiệp riêng không xuất hiện trên bảng tri ân.')}</p>${receipt.bouquet?bouquetMarkup(receipt.bouquet,true):''}${options.canViewFlower?.()?`<button data-action="view-flower">${tr('Xem hoa của bạn')}</button>`:''}<p class="vg-muted">${tr('Mã tiếp nhận: {0}',{0:esc(receipt.id)})}</p><div class="vg-buttons"><button data-action="receipt">${tr('Kiểm tra trạng thái')}</button><button class="vg-primary" data-action="new">${tr('Viết thiệp khác')}</button></div><p class="vg-muted">${tr('Phiếu này được giữ trong phiên trình duyệt hiện tại.')}</p></section>`;
    if (stage === 'preview') return `<section><div class="vg-section-title"><div><h3>${tr('Đọc lại trước khi gửi')}</h3><p>${draft.visibility === 'private' ? tr('Gửi riêng · chỉ người quản trị được phân quyền có thể đọc.') : `${tr('Mọi người có thể đọc nội dung và chữ ký.')} ${approvalHint()}.`}</p></div></div>${cardMarkup({ id: 'preview', message: draft.message, signature: draft.signature, className: draft.className, gift: draft.gift, bookTitle:draft.bookTitle,bookAuthor:draft.bookAuthor,bouquet:draft.bouquet, recipientName: recipientName(), createdAt: '' })}<p class="vg-muted">${draft.visibility === 'public' ? tr('Khi bấm gửi, bạn đồng ý công khai nội dung, chữ ký và lớp đã nhập.') : tr('Bạn đã chọn gửi riêng. Nội dung chỉ dành cho quản trị viên, không gửi email tự động cho thầy cô.')}</p><div class="vg-buttons"><button data-action="edit" ${sending ? 'disabled' : ''}>${tr('Sửa lại')}</button><button class="vg-primary" data-action="submit" ${sending || !config?.event.acceptingSubmissions ? 'disabled' : ''}>${sending ? tr('Đang gửi…') : tr('Gửi lời chúc')}</button></div>${!config?.event.acceptingSubmissions ? `<p class="vg-error">${tr('Hiện chưa thể nhận thiệp. Bản nháp được giữ để gửi sau.')}</p><button type="button" data-action="refresh">${tr('Thử kết nối lại')}</button>` : ''}</section>`;
    return `<form id="vg-compose"><h3>${tr('Viết điều bạn muốn nói')}</h3><p class="vg-muted">${tr('Viết lời chúc, chọn quà tượng trưng rồi xem trước. Không cần di chuyển trong campus.')}</p><label>${tr('Gửi đến')}<select name="recipientId" required>${[{id:'general',name:tr('Tập thể thầy cô và cán bộ nhân viên VJU')},{id:'teacher',name:tr('Thầy/Cô cụ thể')},{id:'other',name:tr('Khác — tự điền')},...(config?.recipients||[]).filter(r=>!['general','teacher','other'].includes(r.id))].map(r=>`<option value="${esc(r.id)}" ${r.id===draft.recipientId?'selected':''}>${esc(r.name)}</option>`).join('')}</select></label>${['teacher','other'].includes(draft.recipientId)?`<label>${draft.recipientId==='teacher'?tr('Tên thầy/cô'):tr('Tên người hoặc tập thể nhận')}<input name="recipientName" maxlength="120" required value="${esc(draft.recipientName)}" placeholder="${tr('Nhập tên người nhận')}" autocomplete="off"></label>`:''}<label>${tr('Lời chúc')} <span class="vg-muted">${tr('10–1.000 ký tự')}</span><textarea name="message" rows="4" minlength="5" maxlength="1000" required placeholder="${tr('Một điều em nhớ về thầy cô… Điều đó đã giúp em… Nhân ngày 20/11, em chúc…')}">${esc(draft.message)}</textarea></label><label>${tr('Chữ ký')} <span class="vg-muted">${tr('không bắt buộc')}</span><input name="signature" maxlength="80" value="${esc(draft.signature)}" placeholder="${tr('Tên hoặc bút danh')}" autocomplete="off"></label><section class="vg-extras"><h4>${tr('Lớp / khóa và quà tượng trưng')}</h4><label>${tr('Lớp / khóa')} <span class="vg-muted">${tr('không bắt buộc')}</span><input name="className" maxlength="80" value="${esc(draft.className)}" placeholder="${tr('Lớp hoặc khóa của bạn')}" autocomplete="off"></label><label>${tr('Món quà tượng trưng')}<select name="gift">${Object.entries(gifts).map(([id, name]) => `<option value="${id}" ${id === draft.gift ? 'selected' : ''}>${name}</option>`).join('')}</select></label>${draft.gift==='book'?`<div class="vg-two"><label>${tr('Tên sách')}<input name="bookTitle" maxlength="160" required value="${esc(draft.bookTitle)}" placeholder="${tr('Cuốn sách bạn muốn tặng')}"></label><label>${tr('Tác giả')}<input name="bookAuthor" maxlength="120" required value="${esc(draft.bookAuthor)}" placeholder="${tr('Tên tác giả')}"></label></div>`:''}</section>${draft.bouquet?`<div class="vg-attached-bouquet">${bouquetMarkup(draft.bouquet,true)}<div><strong>${tr('Bó hoa của bạn')}</strong><p>${esc(bouquetDescription(draft.bouquet))}</p><button type="button" data-action="garden">${tr('Đổi hoa')}</button></div></div>`:draft.gift==='flowers'?`<p class="vg-muted">${tr('Một bó hoa tượng trưng sẽ đi cùng lời chúc. Không cần hái hoa hay trồng chậu.')}</p><button type="button" data-action="garden">${tr('Tùy chọn: tự phối bó hoa')}</button>`:''}${config?.event.publicOnly?`<fieldset><legend>${tr('Bảng Tri Ân công khai')}</legend>${draft.visibility==='private'?`<p class="vg-error">${tr('Nháp cũ đang chọn riêng tư. Chỉ chọn công khai nếu bạn đồng ý đưa thiệp lên bảng.')}</p>`:''}<label class="vg-choice"><input type="checkbox" name="publicConsent" required ${draft.visibility==='public'?'checked':''}><span>${`${tr('Lời chúc, chữ ký và lớp bạn nhập sẽ hiện công khai. Không gửi riêng tới thầy cô.')} ${approvalHint()}.`}</span></label></fieldset>`:`<fieldset><legend>${tr('Ai có thể đọc thiệp?')}</legend><label class="vg-choice"><input type="radio" name="visibility" value="private" ${draft.visibility === 'private' ? 'checked' : ''}><span><strong>${tr('Gửi riêng')}</strong><small>${tr('Chỉ quản trị viên được phân quyền; không lên bảng công khai.')}</small></span></label><label class="vg-choice"><input type="radio" name="visibility" value="public" ${draft.visibility === 'public' ? 'checked' : ''}><span><strong>${tr('Cho phép công khai')}</strong><small>${tr('Mọi người có thể đọc lời chúc, chữ ký và lớp bạn nhập.')} ${approvalHint()}.</small></span></label></fieldset>`}<p class="vg-muted vg-storage">${storageProblem ? tr('Trình duyệt không lưu được bản nháp; hãy giữ cửa sổ này mở.') : tr('Bản nháp được lưu trên trình duyệt này. Dùng máy chung? Xóa bản nháp khi rời đi.')}</p><div class="vg-buttons"><button type="button" data-action="clear">${tr('Xóa bản nháp')}</button><button type="submit" class="vg-primary">${tr('Xem trước thiệp')}</button></div></form>`;
  }
  function gardenEditor(){
    const c=gardenEdit;if(!c)return '';
    return `<form id="vg-garden-edit"><h3>${tr('Sửa nội dung chậu')}</h3><label>${tr('Tên hiển thị')}<input name="signature" maxlength="60" required value="${esc(c.signature)}"></label><label>${tr('Gửi đến')}<input name="recipientName" maxlength="60" required value="${esc(c.recipientName)}"></label><label>${tr('Lời cảm ơn')}<textarea name="message" maxlength="240" required rows="4">${esc(c.message)}</textarea></label><p>${tr('Lưu nội dung không thay đổi trạng thái duyệt.')}</p><div class="vg-buttons"><button type="submit" ${adminBusy?'disabled':''}>${tr('Lưu nội dung')}</button><button type="button" data-cancel-garden-edit ${adminBusy?'disabled':''}>${tr('Hủy sửa')}</button></div></form>`;
  }
  function approvalControls() {
    return `<form id="vg-auto-approval"><h3>${tr('Chế độ kiểm duyệt')}</h3><label class="vg-choice"><input type="checkbox" name="autoApprove" ${config?.event.autoApprove?'checked':''}><span>${tr('Tự động duyệt')}</span></label><p>${config?.event.autoApprove?tr('Thiệp và chậu hoa mới được công khai ngay.'):tr('Duyệt bằng tay: nội dung mới chờ admin/mod duyệt.')}</p><p class="vg-muted">${tr('Không thay đổi nội dung đã gửi. Thiệp riêng vẫn riêng tư.')}</p><button class="vg-primary" type="submit" ${adminBusy?'disabled':''}>${tr('Lưu chế độ duyệt')}</button></form>`;
  }
  function adminMarkup() {
    if (!adminToken && !adminRole) return `<p><a href="/api/auth/sso/authorize">${tr('Đăng nhập SSO VJU để kiểm duyệt')}</a></p><p class="vg-muted">${tr('Chỉ tài khoản được cấp quyền mới mở được hàng đợi.')}</p><form id="vg-admin-login"><h3>${tr('Khu vực quản trị')}</h3><p class="vg-muted">${tr('Nhập mã quản trị do người phụ trách cung cấp. Mã chỉ được giữ trong bộ nhớ và xóa khi đóng bảng.')}</p><label>${tr('Mã quản trị')}<input type="password" name="token" required autocomplete="off"></label><button class="vg-primary" type="submit">${tr('Mở hàng đợi duyệt')}</button></form>`;
    return `<div class="vg-section-title"><h3>${adminSource==='garden'?tr('Quản lý vườn hoa'):tr('Duyệt lời chúc')}</h3><button data-action="logout">${tr('Đăng xuất')}</button></div><div class="vg-buttons vg-admin-source"><button data-admin-source="all" aria-pressed="${adminSource==='all'}">${tr('Duyệt lời chúc')}</button><button data-admin-source="garden" aria-pressed="${adminSource==='garden'}">${tr('Quản lý vườn hoa')}</button></div>${approvalControls()}${adminSource==='all'?feedbackInbox.markup():''}${gardenEditor()}<label>${tr('Trạng thái')}<select id="vg-admin-status"><option value="all" ${adminStatus==='all'?'selected':''}>${tr('Tất cả trạng thái')}</option><option value="pending" ${adminStatus === 'pending' ? 'selected' : ''}>${tr('Chờ duyệt')}</option><option value="approved" ${adminStatus === 'approved' ? 'selected' : ''}>${tr('Đã duyệt')}</option><option value="rejected" ${adminStatus === 'rejected' ? 'selected' : ''}>${tr('Không duyệt')}</option></select></label><div class="vg-admin-list">${adminCards.filter(c=>adminSource==='all'||c.garden).length ? adminCards.filter(c=>adminSource==='all'||c.garden).map(c => `<div class="vg-admin-item"><span class="vg-badge">${c.visibility === 'private' ? tr('THIỆP RIÊNG · không công khai') : tr('Đề nghị công khai')} · ${esc(statusText(c.status))}</span>${c.garden?`<p class="vg-badge">${tr('Vườn Hoa Tri Ân')} · ${tr('Trang {0}, ô {1}',{0:c.garden.page+1,1:c.garden.slot+1})}</p>`:''}${cardMarkup(c)}${c.garden?`<button data-garden-edit="${esc(c.id)}" ${adminBusy?'disabled':''}>${tr('Sửa nội dung chậu')}</button>`:''}<div class="vg-buttons"><button data-moderate="reject" data-id="${esc(c.id)}" ${adminBusy ? 'disabled' : ''}>${c.garden?tr('Gỡ khỏi vườn và bảng'):tr('Xóa khỏi bảng')}</button><button class="vg-primary" data-moderate="approve" data-id="${esc(c.id)}" ${adminBusy ? 'disabled' : ''}>${tr('Duyệt{0}',{0:c.visibility === 'private' ? tr(' thiệp riêng') : tr(' công khai')})}</button></div></div>`).join('') : `<p class="vg-muted">${tr('Không có thiệp trong trạng thái này.')}</p>`}</div>${adminRole==='moderator'?'':`<form id="vg-settings"><h3>${tr('Điều hành Bảng Tri Ân')}</h3><label class="vg-choice"><input type="checkbox" name="accepting" ${config?.event.acceptingSubmissions ? 'checked' : ''}><span>${tr('Nhận thiệp mới')}</span></label><label class="vg-choice"><input type="checkbox" name="effects" ${config?.event.effectsEnabled ? 'checked' : ''}><span>${tr('Bật hiệu ứng lễ hội')}</span></label><label>${tr('Đóng nhận thiệp lúc')} <span class="vg-muted">${tr('giờ Việt Nam · để trống nếu chưa chốt')}</span><input type="datetime-local" name="closingAt" value="${config?.event.closingAt ? new Date(new Date(config.event.closingAt).getTime() + 7 * 3600000).toISOString().slice(0, 16) : ''}"></label><button class="vg-primary" type="submit" ${adminBusy ? 'disabled' : ''}>${tr('Lưu cài đặt')}</button><p class="vg-muted">${tr('Cài đặt áp dụng cho việc nhận lời chúc và hiệu ứng của sự kiện.')}</p></form>`}`;
  }

  function updateDraft(form: HTMLFormElement) {
    const data = new FormData(form);
    const next = { ...draft,recipientName:String(data.get('recipientName')||''),bookTitle:String(data.get('bookTitle')||''),bookAuthor:String(data.get('bookAuthor')||''), recipientId: String(data.get('recipientId') || 'general'), message: String(data.get('message') || ''), signature: String(data.get('signature') || ''), className: String(data.get('className') || ''), gift: data.get('gift') as Gift, visibility: (config?.event.publicOnly?(data.has('publicConsent')?'public':'private'):data.get('visibility')) as Visibility };
    if(next.gift!=='flowers')next.bouquet=undefined;
    if(next.gift!=='book'){next.bookTitle='';next.bookAuthor='';}
    if(!['teacher','other'].includes(next.recipientId))next.recipientName='';
    if(account?.mode==='anonymous'){next.signature='Khách ẩn danh';next.className='';}
    if (JSON.stringify({ ...next, key: '' }) !== JSON.stringify({ ...draft, key: '' })) next.key = uuid();
    draft = next; saveDraft();
  }
  async function submit() {
    if (sending) return;
    sending = true; notify(''); render();
    try {
      const { key, ...body } = draft;
      const result = await api<{ id: string; receiptToken: string; status: string; duplicate: boolean }>('/api/greetings', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) });
      if (typeof result.id!=='string' || !result.id || typeof result.receiptToken!=='string' || !result.receiptToken || typeof result.status!=='string') throw new Error('Phản hồi chưa có mã tiếp nhận. Hãy thử lại với bản nháp đang giữ.');
      receipt = { ...result, visibility: draft.visibility, recipientName: recipientName(), bouquet:draft.bouquet };
      if(draft.bouquet&&JSON.stringify(basket)===JSON.stringify(draft.bouquet)){basket=[];saveBasket();}
      try { sessionStorage.setItem(receiptKey, JSON.stringify(receipt)); localStorage.removeItem(draftKey); } catch { /* Receipt remains in memory. */ }
      draft = emptyDraft(); stage = 'receipt';
      if (!confirmed.has(result.id)) { confirmed.add(result.id); options.onConfirmed(); }
      if(account){const session=await api<{account:{used:number}|null}>('/api/auth/session').catch(()=>null);if(session?.account)account.used=session.account.used;}
      void sharedGarden.refresh();
      notify(result.duplicate ? tr('Máy chủ xác nhận thiệp này đã được nhận trước đó; không tạo thiệp trùng.') : result.status==='approved'?(receipt.visibility==='public'?tr('Đã gửi và công khai lời chúc.'):tr('Đã nhận thiệp riêng.')):result.status==='pending'?tr('Đã gửi thành công. Thiệp đang chờ duyệt.'):tr('Đã nhận thiệp. Nội dung không được duyệt.'));
      void refresh();
    } catch (error) { notify(trServer((error as Error).message), true); }
    finally { sending = false; render('h3'); }
  }
  async function loadAdmin() {
    if ((!adminToken && !adminRole) || !dialog.open) return;
    const session = adminSession, request = ++adminRequest;
    try {
      const result = await api<{ greetings: AdminGreeting[] }>(`/api/admin/greetings?status=${encodeURIComponent(adminStatus)}`, { headers: adminHeaders() });
      if (session !== adminSession || request !== adminRequest || !dialog.open || (!adminToken && !adminRole)) return;
      adminCards = result.greetings; notify(''); render();
    } catch (error) { if (session !== adminSession || request !== adminRequest) return; adminToken = ''; adminRole = null; adminCards = []; gardenEdit=null; feedbackInbox.clear(); notify(trServer((error as Error).message), true); render(); }
  }
  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      const quotaBefore=account?.used;
      const [nextConfig, nextCards,session] = await Promise.all([api<FestivalConfig>('/api/config'), api<{ greetings: PublicGreeting[] }>('/api/greetings'),account?api<{account:{used:number}|null}>('/api/auth/session'):Promise.resolve(null)]);
      if(account&&session?.account)account.used=session.account.used;
      const acceptanceChanged = config?.event.acceptingSubmissions !== nextConfig.event.acceptingSubmissions || config?.event.autoApprove !== nextConfig.event.autoApprove;
      const policyChanged=config?.event.publicOnly!==nextConfig.event.publicOnly || config?.event.autoApprove!==nextConfig.event.autoApprove;
      if(!Array.isArray(nextCards.greetings))throw new Error('Danh sách thiệp chưa đúng định dạng. Hãy thử lại.');
      config = nextConfig; cards = nextCards.greetings; refreshProblem = '';if(messageIsError)notify('');
      options.onConfig(config); options.onPublicCards(cards);
      if (dialog.open && (tab === 'board'||(tab==='compose'&&stage==='edit'&&(policyChanged||quotaBefore!==account?.used)&&!sending))) render();
      else if (dialog.open && tab === 'compose' && stage === 'preview' && acceptanceChanged && !sending) render();
    } catch (error) {
      refreshProblem = tr('Chưa cập nhật được bảng. Những thiệp đang thấy là lần tải thành công gần nhất.');
      if (!config) refreshProblem = trServer((error as Error).message);
      if (dialog.open && (tab === 'board'||(tab==='compose'&&stage==='preview'))) { notify(trServer((error as Error).message), true); render(); }
    } finally { refreshing = false; }
  }
  const cardObserver = new ResizeObserver(entries => {
    for (const { target } of entries) {
      const card = target.closest('.vg-card')!;
      const button = card.querySelector<HTMLButtonElement>('.vg-card-more')!;
      if (button.getAttribute('aria-expanded') === 'false') button.hidden = ![...card.querySelectorAll('.vg-card-message,.vg-card-recipient,.vg-signature')].some(part => part.scrollHeight > part.clientHeight + 1);
    }
  });
  function bind() {
    const participantForm=dialog.querySelector<HTMLFormElement>('#vg-compose');
    if(participantForm&&account){
      participantForm.querySelector('.vg-muted')!.textContent=tr('{0} · Đã gửi {1}/3 lời cảm ơn. Thiệp và chậu hoa dùng chung hạn mức.',{0:tName(account.name),1:account.used});
      if(account.mode==='anonymous')for(const name of ['signature','className']){const input=participantForm.querySelector<HTMLInputElement>(`[name="${name}"]`)!;input.value=name==='signature'?tName('Khách ẩn danh'):'';input.readOnly=true;}
    }
    cardObserver.disconnect();
    dialog.querySelectorAll<HTMLButtonElement>('.vg-card-more').forEach(button => {
      const message = button.previousElementSibling as HTMLElement;
      const card = message.closest('.vg-card')!;
      card.querySelectorAll('.vg-card-message,.vg-card-recipient,.vg-signature').forEach(part => cardObserver.observe(part));
      button.onclick = () => {
        const expanded = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', String(expanded));
        card.classList.toggle('is-expanded', expanded);
        button.textContent = expanded ? tr('Thu gọn') : tr('Xem thêm');
      };
    });
    dialog.querySelectorAll<HTMLElement>('[data-pick]').forEach(button=>button.onclick=()=>{if(!sending&&isFlower(button.dataset.pick))pickFlower(button.dataset.pick);});
    dialog.querySelectorAll<HTMLElement>('[data-remove-flower]').forEach(button=>button.onclick=()=>{if(sending)return;basket=basket.filter((_,i)=>i!==Number(button.dataset.removeFlower));saveBasket();notify(tr('Đã bỏ một bông. Bạn có thể chọn hoa khác.'));render();});
    dialog.querySelector('.vg-close')?.addEventListener('click', close);
    dialog.querySelectorAll<HTMLElement>('[data-tab]').forEach(button => button.onclick = () => { if (sending) return; plantFirst = false; tab = button.dataset.tab as typeof tab; notify(''); render(); if(tab==='admin')void loadAdmin(); });
    dialog.querySelector('#vg-shared-garden')?.addEventListener('click',()=>{close();sharedGarden.open();});
    const form = dialog.querySelector<HTMLFormElement>('#vg-compose');
    form?.addEventListener('input', () => updateDraft(form));
    form?.addEventListener('change', event => {updateDraft(form);const name=(event.target as HTMLInputElement).name;if(['gift','recipientId'].includes(name))render(`[name="${name}"]`);});
    form?.addEventListener('submit', event => {
      event.preventDefault(); updateDraft(form);
      if ([...draft.message.trim()].length < minMessageLength(draft.message)) { notify(tr('Hãy viết ít nhất 10 ký tự có nội dung.'), true); return; }
      stage = 'preview'; notify(''); render();
    });
    dialog.querySelectorAll<HTMLElement>('[data-action]').forEach(button => button.onclick = async () => {
      const action = button.dataset.action;
      if(sending)return;
      if(action==='view-planted'){close();options.onViewFlower?.();return;}
      if(action==='view-flower'){close();options.onViewFlower?.();return;}
      if(action==='garden'){plantFirst=false;tab='garden';notify('');render();return;}
      if(action==='empty-basket'){basket=[];saveBasket();notify(tr('Giỏ hoa đã trống.'));render();return;}
      if(action==='wrap-bouquet'){if(basket.length!==BOUQUET_SIZE)return;const same=draft.gift==='flowers'&&JSON.stringify(draft.bouquet)===JSON.stringify(basket);draft={...draft,gift:'flowers',bouquet:[...basket],key:same?draft.key:uuid()};saveDraft();tab='compose';stage='edit';notify(tr('Bó hoa đã đính kèm. Hãy chọn người nhận và viết lời tri ân.'));render('h3');return;}
      if (action === 'refresh') { await refresh(); if(dialog.open)render(); return; }
      if (action === 'write') { tab = 'compose'; stage = 'edit'; }
      if (action === 'edit') stage = 'edit';
      if (action === 'clear') { draft = emptyDraft(); saveDraft(); }
      if (action === 'new') { receipt = null; stage = 'edit'; try { sessionStorage.removeItem(receiptKey); } catch { /* optional */ } }
      if (action === 'submit') { await submit(); return; }
      if (action === 'logout') { try { if(adminRole)await api('/api/auth/sso/logout',{method:'POST'}); adminSession++; adminToken = ''; adminRole=null; adminCards = []; gardenEdit=null; feedbackInbox.clear(); window.dispatchEvent(new CustomEvent('vju-moderation-ended')); } catch(error) { notify(trServer((error as Error).message),true); render(); return; } }
      if (action === 'receipt' && receipt) {
        button.setAttribute('disabled', '');
        try { receipt = { ...receipt, ...await api<Receipt>(`/api/receipts/${encodeURIComponent(receipt.id)}`, { headers: { Authorization: `Bearer ${receipt.receiptToken}` } }) }; notify(tr('Đã cập nhật trạng thái.')); }
        catch (error) { notify(trServer((error as Error).message), true); }
      } else notify('');
      render();
    });
    dialog.querySelector<HTMLFormElement>('#vg-admin-login')?.addEventListener('submit', async event => {
      event.preventDefault(); const form = event.currentTarget as HTMLFormElement;
      adminToken = String(new FormData(form).get('token') || '').trim();
      adminSession++;
      const button = form.querySelector('button')!; button.disabled = true;
      await loadAdmin();
    });
    dialog.querySelector<HTMLSelectElement>('#vg-admin-status')?.addEventListener('change', async event => { adminStatus = (event.target as HTMLSelectElement).value; await loadAdmin(); });
    dialog.querySelectorAll<HTMLButtonElement>('[data-admin-source]').forEach(b=>b.onclick=async()=>{if(adminBusy)return;adminSource=b.dataset.adminSource as 'all'|'garden';gardenEdit=null;if(adminSource==='garden')adminStatus='all';render();await loadAdmin();});
    dialog.querySelectorAll<HTMLButtonElement>('[data-garden-edit]').forEach(b=>b.onclick=()=>{const c=adminCards.find(c=>c.id===b.dataset.gardenEdit);gardenEdit=c?{...c}:null;gardenEditExpected=c?{signature:c.signature,recipientName:c.recipientName,message:c.message}:null;render();dialog.querySelector<HTMLInputElement>('#vg-garden-edit input')?.focus();});
    dialog.querySelector('[data-cancel-garden-edit]')?.addEventListener('click',()=>{gardenEdit=null;render();});
    dialog.querySelector<HTMLFormElement>('#vg-garden-edit')?.addEventListener('input',event=>{if(!gardenEdit)return;const f=new FormData(event.currentTarget as HTMLFormElement);gardenEdit={...gardenEdit,signature:String(f.get('signature')||''),recipientName:String(f.get('recipientName')||''),message:String(f.get('message')||'')};});
    dialog.querySelector<HTMLFormElement>('#vg-garden-edit')?.addEventListener('submit',async event=>{
      event.preventDefault();if(adminBusy||!gardenEdit)return;
      const form=new FormData(event.currentTarget as HTMLFormElement),original=adminCards.find(c=>c.id===gardenEdit!.id);if(!original)return;
      const changed={signature:String(form.get('signature')||''),recipientName:String(form.get('recipientName')||''),message:String(form.get('message')||'')};
      gardenEdit={...original,...changed};adminBusy=true;render();
      try{await api(`/api/admin/greetings/${encodeURIComponent(original.id)}/garden-edit`,{method:'POST',headers:adminHeaders(),body:JSON.stringify({...changed,expected:gardenEditExpected})});gardenEdit=null;await loadAdmin();await refresh();await sharedGarden.refresh();notify(tr('Đã lưu nội dung chậu.'));}
      catch(error){notify(trServer((error as Error).message),true);}
      finally{adminBusy=false;render();}
    });
    dialog.querySelectorAll<HTMLButtonElement>('[data-moderate]').forEach(button => button.onclick = async () => {
      if(button.dataset.moderate==='reject'&&!window.confirm(tr('Xóa lời chúc khỏi bảng công khai? Nội dung vẫn được giữ trong mục Không duyệt.')))return;
      if (adminBusy) return; adminBusy = true; render();
      try { await api(`/api/admin/greetings/${encodeURIComponent(button.dataset.id!)}/moderate`, { method: 'POST', headers: adminHeaders(), body: JSON.stringify({ action: button.dataset.moderate }) }); await loadAdmin(); await refresh(); await sharedGarden.refresh(); notify(tr('Đã cập nhật quyết định duyệt.')); }
      catch (error) { notify(trServer((error as Error).message), true); }
      finally { adminBusy = false; render(); }
    });
    dialog.querySelector<HTMLFormElement>('#vg-auto-approval')?.addEventListener('submit', async event => {
      event.preventDefault(); if(adminBusy)return;
      const autoApprove=new FormData(event.currentTarget as HTMLFormElement).has('autoApprove');
      adminBusy=true;render();
      try{const result=await api<{event:FestivalConfig['event']}>('/api/admin/approval-mode',{method:'POST',headers:adminHeaders(),body:JSON.stringify({autoApprove})});
        if(config){config={...config,event:result.event};options.onConfig(config);}
        void sharedGarden.refresh();notify(result.event.autoApprove?tr('Đã bật tự động duyệt nội dung mới.'):tr('Đã tắt tự động duyệt. Nội dung mới sẽ chờ duyệt tay.'));
      }catch(error){notify((error as Error).message,true);}
      finally{adminBusy=false;render();}
    });
    dialog.querySelector<HTMLFormElement>('#vg-settings')?.addEventListener('submit', async event => {
      event.preventDefault(); if (adminBusy) return;
      const data = new FormData(event.currentTarget as HTMLFormElement);
      const closingAt = String(data.get('closingAt') || ''); adminBusy = true; render();
      try {
        const result = await api<{ event: FestivalConfig['event'] }>('/api/admin/settings', { method: 'POST', headers: adminHeaders(), body: JSON.stringify({ acceptingSubmissions: data.has('accepting'), effectsEnabled: data.has('effects'), closingAt: closingAt ? new Date(`${closingAt}:00+07:00`).toISOString() : null, mode: 'rehearsal' }) });
        if (config) { config = { ...config, event: result.event }; options.onConfig(config); }
        notify(tr('Đã lưu cài đặt phiên chạy thử.'));
      } catch (error) { notify(trServer((error as Error).message), true); }
      finally { adminBusy = false; render(); }
    });
  }
  function show() {
    if (dialog.open) return;
    lastFocus = document.activeElement as HTMLElement;
    render(); dialog.showModal(); options.onOpenChange(true); void refresh();
  }
  function close() { dialog.close(); }
  dialog.addEventListener('close', () => { adminSession++; adminToken = ''; adminCards = []; gardenEdit=null; gardenEditExpected=null; feedbackInbox.clear(); if (tab === 'admin') tab = 'board'; render(); options.onOpenChange(false); lastFocus?.focus(); });
  dialog.addEventListener('keydown', event => { event.stopPropagation(); });
  dialog.addEventListener('cancel', () => { /* Native dialog Escape closes, then runs close handler. */ });
  window.addEventListener('online', () => { void refresh(); });
  setInterval(() => { if (!document.hidden&&dialog.open&&tab==='board') void refresh(); }, 45000);
  void api<{role:'admin'|'moderator'|null}>('/api/admin/session').then(result=>{adminRole=result.role;if(adminRole){window.dispatchEvent(new CustomEvent('vju-moderation-ready'));if(dialog.open){render();if(tab==='admin')void loadAdmin();}}}).catch(()=>{});
  void refresh();
  return {getFlowerState(){const next=advanceFlowerLoop(flowerState,Date.now());if(next.epochStart!==flowerState.epochStart){flowerState=next;saveBasket();}else flowerState=next;return sharedGarden.state(flowerState);},sharedGarden,pickFlower,getBasket:()=>[...basket],
    /** Plant the carried bouquet in a bed chosen in the 3D garden. Local to this browser, like the form. */
/** Plant the carried bouquet in a bed chosen in the 3D garden. Local to this browser, like the form. */
openGarden:()=>{tab='garden';plantFirst=basket.length>0&&flowerState.planted.some(p=>!p);if(dialog.open)render();else show();}, open: () => { tab = 'board'; if (dialog.open) render(); else show(); }, close, openCompose: () => { tab = 'compose'; if (dialog.open) render(); else show(); }, openAdmin: () => { window.dispatchEvent(new Event('vju-campus-exit')); tab = 'admin'; if (dialog.open) render(); else show(); void loadAdmin(); }, refresh, isOpen: () => dialog.open||sharedGarden.isOpen() };
}
