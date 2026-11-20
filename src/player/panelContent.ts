import {tr} from '../i18n/index.ts';
import {FLOWERS,flowerIcon,type FlowerKind} from '../greetings/flowers';

/** Presentation only: picking, quotas, navigation and persistence stay in the HUD. */
/** Presentation only: picking, quotas, navigation and persistence stay in the HUD. */
export function bagContent(basket:FlowerKind[],near:boolean,pots:number){
  const full=basket.length===5;
  const flowers=(Object.keys(FLOWERS) as FlowerKind[]).map(kind=>
    `<button data-pick="${kind}" aria-label="${tr('Hái {0}',{0:FLOWERS[kind].name})}">${flowerIcon(kind)}<span>${FLOWERS[kind].name}</span></button>`).join('');
  return `<div class="bag-heading"><strong>${full?tr('Bó hoa đã đủ'):tr('Bó hoa đang hái')}</strong><span>${tr('{0} / 5 bông',{0:basket.length})}</span></div>
    <div class="rpg-slots" role="list" aria-label="${tr('Hoa trong túi')}">${Array.from({length:5},(_,i)=>`<div role="listitem" aria-label="${basket[i]?FLOWERS[basket[i]].name:tr('Ô trống')}">${basket[i]?flowerIcon(basket[i]):'<span aria-hidden="true">＋</span>'}</div>`).join('')}</div>
    <p class="panel-hint">${full?tr('Đính kèm thiệp hoặc mang đi cắm trong vườn.'):near?tr('Chọn hoa để thêm vào bó.'):tr('Đến vườn hái hoa bên Bảng Tri Ân để thêm hoa.')}</p>
    ${near&&!full?`<div class="rpg-pick" aria-label="${tr('Chọn hoa')}">${flowers}</div>`:''}
    <div class="panel-actions">${!near&&!full?`<button class="rpg-primary" data-do="find-flowers">${tr('Chỉ đường đến vườn hoa')}</button>`:''}${full?`<button class="rpg-primary" data-do="write">${tr('Viết thiệp')}</button>`:''}<button data-do="garden">${basket.length?tr('Cắm bó hoa'):tr('Xem vườn của bạn')}</button></div>
    <details class="panel-details"><summary>${tr('Cách dùng túi hoa')}</summary><p>${tr('Có thể cắm từ 1 bông; hái đủ 5 bông để đính kèm thiệp. Hoa trong túi được lưu trên trình duyệt này.')}</p><p>${tr('Đã gửi {0}/3 chậu trong vườn chung. Thiệp và chậu hoa dùng chung lượt gửi.',{0:pots})}</p>${!near&&!full?`<p>${tr('Có {0} loài hoa để phối thành bó.',{0:Object.keys(FLOWERS).length})}</p>`:''}</details>`;
}

export function cameraContent(view:string){
  return `<section aria-label="${tr('Chọn góc nhìn')}"><div class="rpg-camera">${[['third',tr('Theo nhân vật')],['first',tr('Tầm mắt')],['overview',tr('Toàn cảnh')]].map(([v,t])=>`<button data-view="${v}" aria-pressed="${view===v}">${t}</button>`).join('')}</div>
    <p class="panel-hint">${tr('Toàn cảnh: kéo hoặc vuốt để xoay và nghiêng góc nhìn.')}</p></section>
    <details class="panel-details camera-settings"><summary>${tr('Hiển thị & hiệu ứng')}</summary><div class="camera-graphics"></div><div class="camera-toggles"><label class="rpg-motion"><input type="checkbox" id="rpg-motion" ${document.body.classList.contains('reduced-motion')?'checked':''}> ${tr('Giảm chuyển động')}</label><label class="rpg-motion"><input type="checkbox" id="rpg-ambience" ${document.body.classList.contains('ambience-off')?'':'checked'}> ${tr('Đom đóm & gió')}</label></div></details>
    <section class="camera-festival" aria-label="${tr('Sân khấu')}"><h3>${tr('Sân khấu 20/11')}</h3><div class="panel-actions"><button data-do="finale">${tr('Xem kết lễ')}</button><button data-do="stage-mode">${tr('Đổi câu nói')}</button></div></section>`;
}

export function journeyContent(state:{board:boolean;flowers:boolean;planted:boolean;sent:boolean;celebrated:boolean;accepting:boolean}){
  const steps=[
    [state.board,tr('Ghé Bảng Tri Ân'),tr('Rẽ trái từ cổng vào sân.')],
    [state.flowers,tr('Hái & phối hoa'),tr('Vườn hái nằm bên phải bảng.')],
    [state.planted,tr('Cắm hoa có ghi danh'),tr('Mang bó hoa tới vườn cắm ở góc trái sân.')],
    [state.sent,tr('Gửi lời chúc'),state.accepting?tr('Viết thiệp khi bạn muốn.'):tr('Đang tạm ngừng nhận thiệp.')],
    [state.celebrated,tr('Ngắm kết lễ'),tr('Mở Góc nhìn → Xem kết lễ.')],
  ];
  return `<p class="panel-hint">${tr('Khám phá theo nhịp của bạn. Không cần hoàn thành đủ các chặng.')}</p><ol class="rpg-quests">${steps.map(([done,title,hint])=>`<li class="${done?'done':''}"><b>${done?'✓':'○'} ${title}</b><span>${hint}</span></li>`).join('')}</ol><button data-do="board">${tr('Mở Bảng Tri Ân')}</button>`;
}
