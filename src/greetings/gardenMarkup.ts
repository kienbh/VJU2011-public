import {tr} from '../i18n/index.ts';
import {BOUQUET_SIZE,FLOWERS,bouquetMarkup,flowerIcon,type FlowerKind} from './flowers';

export function gardenMarkup(basket:FlowerKind[],attached:boolean,storageProblem:boolean,plantingAbove=false) {
  const full=basket.length===BOUQUET_SIZE;
  return `<section class="vg-garden"><div class="vg-section-title"><div><h3>${tr('Hái một bó hoa, gửi một lời tri ân.')}</h3><p>${tr('Chọn hoa theo ý mình rồi trồng vào ô phía {0}. Viết thiệp là lựa chọn riêng; không bắt buộc.',{0:plantingAbove?tr('trên'):tr('dưới')})}</p></div><span class="vg-basket-count">${tr('{0} / {1} bông',{0:basket.length,1:BOUQUET_SIZE})}</span></div>
    <div class="vg-garden-layout"><div class="vg-flower-choices">${(Object.keys(FLOWERS) as FlowerKind[]).map(kind=>`<button type="button" class="vg-flower-choice" data-pick="${kind}" ${full?'disabled':''}>${flowerIcon(kind)}<span><strong>${FLOWERS[kind].name}</strong><small>${FLOWERS[kind].hint}</small></span><b>${tr('Hái 1 bông')}</b></button>`).join('')}</div>
    <div class="vg-basket-preview">${bouquetMarkup(basket,full)}<p>${full?tr('Bó hoa đã đủ 5 bông. Bạn có thể trồng ngay hoặc đính kèm một lời tri ân.'):tr('Bạn có thể chọn nhiều bông cùng loại hoặc phối cả ba loại hoa.')}</p>
    <div class="vg-picked">${basket.map((kind,i)=>`<button type="button" data-remove-flower="${i}" aria-label="${tr('Bỏ bông {0} thứ {1}',{0:FLOWERS[kind].name.toLowerCase(),1:i+1})}">${flowerIcon(kind)}<span>×</span></button>`).join('')}</div></div></div>
    <p class="vg-muted vg-storage">${storageProblem?tr('Trình duyệt không lưu được giỏ hoa; hãy giữ cửa sổ này mở.'):tr('Giỏ hoa được giữ trên trình duyệt này nếu bạn rời vườn hoặc mất mạng.')}</p>
    <div class="vg-buttons"><button type="button" data-action="empty-basket" ${basket.length?'':'disabled'}>${tr('Hái lại từ đầu')}</button><button type="button" data-action="wrap-bouquet" class="vg-primary" ${full?'':'disabled'}>${attached?tr('Thay bó hoa trong thiệp'):tr('Bó hoa & viết lời tri ân')}</button></div>
    <p class="vg-muted">${tr('Hoa là quà tượng trưng trong game. Bạn vẫn có thể viết thiệp trực tiếp nếu không muốn hái hoa.')}</p>
  </section>`;
}
