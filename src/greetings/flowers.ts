import {tr} from '../i18n/index.ts';
export type FlowerKind = 'rose' | 'daisy' | 'sunflower' | 'cosmos' | 'lavender' | 'tulip' | 'lotus' | 'chrysanthemum' | 'bidens';
export const BOUQUET_SIZE=5;
export const FLOWERS: Record<FlowerKind,{name:string;color:string;centre:string;hint:string}>={
  bidens:{name:tr('Xuyến Chi'),color:'#fffdf4',centre:'#edc43c',hint:tr('Một điều giản dị đáng quý')},
  rose:{name:tr('Hoa hồng'),color:'#d77989',centre:'#a94c63',hint:tr('Một lời cảm ơn')},
  daisy:{name:tr('Cúc trắng'),color:'#fff8df',centre:'#d4a642',hint:tr('Một kỷ niệm đẹp')},
  cosmos:{name:tr('Sao nhái'),color:'#e998b7',centre:'#e2b85d',hint:tr('Một niềm vui nhỏ')},
  lavender:{name:tr('Oải hương'),color:'#aa98cd',centre:'#79609c',hint:tr('Một lời chúc bình an')},
  sunflower:{name:tr('Hướng dương'),color:'#ecc35a',centre:'#77523b',hint:tr('Một lời chúc sáng tươi')},
  tulip:{name:'Tulip',color:'#e2574c',centre:'#f3d36b',hint:tr('Một lời yêu thương')},
  lotus:{name:'Hoa sen',color:'#f2a7c0',centre:'#e8c657',hint:tr('Một lòng kính trọng')},
  chrysanthemum:{name:tr('Cúc vàng'),color:'#f0c33c',centre:'#b9862b',hint:tr('Một lời chúc sức khỏe')},
};
export function isFlower(value:unknown):value is FlowerKind{return typeof value==='string'&&Object.hasOwn(FLOWERS,value);}
export function readFlowers(value:unknown):FlowerKind[]{return Array.isArray(value)?value.filter(isFlower).slice(0,BOUQUET_SIZE):[];}
export function flowerShape(kind:FlowerKind,x:number,y:number,size=1) {
  const f=FLOWERS[kind],n=kind==='bidens'?5:kind==='tulip'?6:kind==='rose'||kind==='cosmos'||kind==='lotus'?8:kind==='chrysanthemum'?18:12;
  if(kind==='lavender')return `<g transform="translate(${x} ${y}) scale(${size})"><path d="M0 20V-23" stroke="#557649" stroke-width="3"/>${Array.from({length:12},(_,i)=>`<ellipse cx="${i%2?4:-4}" cy="${15-Math.floor(i/2)*7}" rx="4" ry="5" fill="${f.color}"/>`).join('')}</g>`;
  return `<g transform="translate(${x} ${y}) scale(${size})">${Array.from({length:n},(_,i)=>`<ellipse cx="0" cy="-10" rx="${kind==='rose'||kind==='tulip'?7:kind==='lotus'?6:kind==='chrysanthemum'?3:4}" ry="${kind==='sunflower'?11:9}" fill="${f.color}" stroke="${kind==='daisy'?'#d5ccb2':f.centre}" stroke-width=".55" transform="rotate(${i*360/n})"/>`).join('')}<circle r="${kind==='sunflower'?7:5}" fill="${f.centre}"/></g>`;
}
export function flowerIcon(kind:FlowerKind){return `<svg viewBox="0 0 64 64" aria-hidden="true">${flowerShape(kind,32,30,1.35)}</svg>`;}
export function bouquetDescription(flowers:FlowerKind[]) {
  return (Object.keys(FLOWERS) as FlowerKind[]).map(k=>{const n=flowers.filter(v=>v===k).length;return n?`${n} ${FLOWERS[k].name.toLowerCase()}`:'';}).filter(Boolean).join(', ');
}
export function bouquetMarkup(flowers:FlowerKind[],wrapped=false) {
  const positions=[[77,55],[111,38],[148,52],[94,85],[135,84]];
  return `<svg class="vg-bouquet-art" viewBox="0 0 230 190" role="img" aria-label="${flowers.length?tr('Bó hoa: {0}',{0:bouquetDescription(flowers)}):tr('Chưa hái hoa')}">
    <ellipse cx="115" cy="173" rx="59" ry="9" fill="#846849" opacity=".1"/>
    ${wrapped?'<path d="M52 79 L176 79 L139 163 L105 174Z" fill="#d5b991"/><path d="M52 79 L115 103 L139 163 L105 174Z" fill="#eee1c5"/>':''}
    ${flowers.map((_,i)=>`<path d="M${positions[i][0]} ${positions[i][1]} Q110 118 121 163" stroke="#718258" stroke-width="3" fill="none"/>`).join('')}
    ${flowers.map((kind,i)=>flowerShape(kind,positions[i][0],positions[i][1],i===1?1.12:1)).join('')}
    ${wrapped?'<path d="M104 141 Q77 119 91 150 Q103 156 119 145 Q150 122 145 145 Q140 156 119 145" stroke="#a65558" stroke-width="5" fill="none"/><path d="M118 145 L105 172 M121 145 L135 168" stroke="#a65558" stroke-width="4"/>':''}
    ${!flowers.length?'<circle cx="115" cy="92" r="42" fill="none" stroke="#b6a48c" stroke-dasharray="4 7"/><text x="115" y="99" text-anchor="middle" fill="#8b755e" font-size="24">＋</text>':''}
  </svg>`;
}
